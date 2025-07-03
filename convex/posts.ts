import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { getAuthenticatedUser } from "./users";
import { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorised");
    return await ctx.storage.generateUploadUrl();
})

export const createPost = mutation({
    args: {
        caption: v.optional(v.string()),
        storageIds: v.array(v.id("_storage")),
        type: v.optional(v.union(v.literal("image"), v.literal("video"))),
    },
    handler: async (ctx, args) => {
        const currentUser = await getAuthenticatedUser(ctx);
        
        if (args.storageIds.length === 0) throw new Error("No media provided");

        // Get URLs for all media
        const mediaUrls = await Promise.all(
            args.storageIds.map(async (storageId) => {
                const url = await ctx.storage.getUrl(storageId);
                if (!url) throw new Error("Media Not Found");
                return { imageUrl: url, storageId };
            })
        );

        // Create post with first media as main media and rest as additional media
        const postId = await ctx.db.insert("posts", {
            userId: currentUser._id,
            imageUrl: mediaUrls[0].imageUrl,
            storageId: mediaUrls[0].storageId,
            caption: args.caption,
            likes: 0,
            comments: 0,
            type: args.type || "image",
            additionalImages: mediaUrls.slice(1),
        });

        // Increment user's posts count
        await ctx.db.patch(currentUser._id, {
            posts: currentUser.posts + 1
        });

        return postId;
    }    
});

export const getFeedPosts = query({
    handler: async(ctx) => {
        const currentUser = await getAuthenticatedUser(ctx);

        //get all post
        const posts = await ctx.db.query("posts").order("desc").collect();

        if (posts.length === 0) return [];

        //enhance posts
        const postsWithInfo = await Promise.all(
            posts.map(async(post) => {
                const postAuthor = (await ctx.db.get(post.userId));
                if (!postAuthor) throw new Error("Post author not found");

                // Check if post is liked
                const likes = await ctx.db
                    .query("likes")
                    .withIndex("by_user_post", (q) => 
                        q.eq("userId", currentUser._id)
                         .eq("postId", post._id)
                    )
                    .collect();

                // Check if post is bookmarked
                const bookmarks = await ctx.db
                    .query("bookmarks")
                    .withIndex("by_user_post", (q) => 
                        q.eq("userId", currentUser._id)
                         .eq("postId", post._id)
                    )
                    .collect();

                return {
                    ...post,
                    author: {
                        _id: postAuthor._id,
                        username: postAuthor.username,
                        image: postAuthor.image
                    },
                    isLiked: likes.length > 0,
                    isBookmarked: bookmarks.length > 0
                };
            })
        );

        return postsWithInfo;
    }
});

export const toggleLike = mutation({
    args: { postId: v.id("posts") },
    handler: async (ctx, args) => {
        const currentUser = await getAuthenticatedUser(ctx);

        // Check if already liked using filter
        const existing = await ctx.db
            .query("likes")
            .filter((q) => 
                q.and(
                    q.eq(q.field("userId"), currentUser._id),
                    q.eq(q.field("postId"), args.postId)
                )
            )
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
            // Decrement likes count
            const post = await ctx.db.get(args.postId);
            if (post) {
                await ctx.db.patch(args.postId, {
                    likes: post.likes - 1,
                });
            }
            return false;
        }

        // Add like
        await ctx.db.insert("likes", {
            userId: currentUser._id,
            postId: args.postId,
        });

        // Increment likes count
        const post = await ctx.db.get(args.postId);
        if (post) {
            await ctx.db.patch(args.postId, {
                likes: post.likes + 1,
            });

            // Create notification if it's not my post
            if (currentUser._id !== post.userId) {
                await ctx.db.insert("notifications", {
                    receiverId: post.userId,
                    senderId: currentUser._id,
                    type: "like",
                    postId: args.postId,
                });
            }
        }
        return true;
    },
});

export const addComment = mutation({
    args: { 
        postId: v.id("posts"),
        comment: v.string(),
    },
    handler: async (ctx, args) => {
        const currentUser = await getAuthenticatedUser(ctx);

        // Add comment
        const commentId = await ctx.db.insert("comments", {
            userId: currentUser._id,
            postId: args.postId,
            comment: args.comment,
        });

        // Increment comments count
        const post = await ctx.db.get(args.postId);
        if (post) {
            await ctx.db.patch(args.postId, {
                comments: post.comments + 1,
            });
        }

        return commentId;
    },
});

export const getComments = query({
    args: { postId: v.id("posts") },
    handler: async (ctx, args) => {
        const comments = await ctx.db
            .query("comments")
            .filter((q) => q.eq(q.field("postId"), args.postId))
            .collect();

        const commentsWithUser = await Promise.all(
            comments.map(async (comment) => {
                const user = await ctx.db.get(comment.userId);
                if (!user) throw new Error("User not found");
                
                return {
                    _id: comment._id,
                    comment: comment.comment,
                    user: {
                        _id: user._id,
                        username: user.username,
                        image: user.image,
                    },
                };
            })
        );

        return commentsWithUser;
    },
});

export const deletePost = mutation({
    args: {postId: v.id("posts")},
    handler: async (ctx, args) => {

        const currentUser = await getAuthenticatedUser(ctx);

        const post = await ctx.db.get(args.postId);
        if (!post) throw new Error("Post Not Found");

        //verify ownership

        if (post.userId !== currentUser._id) throw new Error ("Not authorized to delete this post");

        //delete associated likes

        const likes = await ctx.db
            .query("likes")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();
        
            for (const like of likes) {
                await ctx.db.delete(like._id);

            }

            //delete associated comments
            const comments = await ctx.db
            .query("comments")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();
        
            for (const comment of comments) {
                await ctx.db.delete(comment._id);

            }

            //delete associated bookmarks
            const bookmarks = await ctx.db
            .query("bookmarks")
            .withIndex("by_post", (q) => q.eq("postId", args.postId))
            .collect();
        
            for (const bookmark of bookmarks) {
                await ctx.db.delete(bookmark._id);

            }

            //delete associated notifications
            const notifications= await ctx.db
                .query("notifications")
                .withIndex("by_post", (q) => q.eq("postId", args.postId))
                .collect();

            for (const notification of notifications) {
                await ctx.db.delete(notification._id);
            }

            //delete the post
            await ctx.storage.delete(post.storageId);

            await ctx.db.delete(args.postId);

            //decrement user's post count by 1
            await ctx.db.patch(currentUser._id, {
                posts: Math.max(0, (currentUser.posts || 1) -1),
            });


            
            
    }
})

export const getPostsByUser = query({
    args: {
        userId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const user = args.userId ? await ctx.db.get(args.userId) : await getAuthenticatedUser(ctx);

        if (!user) throw new Error("User not found");

        const posts = await ctx.db
            .query("posts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId || user._id))
            .collect();
        return posts;
    }
})


