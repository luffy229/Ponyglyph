import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser } from "./users";
import { Id } from "./_generated/dataModel";

export const toggleBookmark = mutation({
    args: { postId: v.id("posts") },
    handler: async (ctx, args) => {
        const currentUser = await getAuthenticatedUser(ctx);

        // Check if already bookmarked
        const bookmarks = await ctx.db
            .query("bookmarks")
            .withIndex("by_user_post", (q) => 
                q.eq("userId", currentUser._id)
                 .eq("postId", args.postId)
            )
            .collect();

        if (bookmarks.length > 0) {
            await ctx.db.delete(bookmarks[0]._id);
            return false;
        }

        // Add bookmark
        await ctx.db.insert("bookmarks", {
            userId: currentUser._id,
            postId: args.postId,
        });
        return true;
    }
});

export const getBookmarkedPosts = query({
    handler: async (ctx) => {
        const currentUser = await getAuthenticatedUser(ctx);

        // get all bookmarks of the current user
        const bookmarks = await ctx.db
            .query("bookmarks")
            .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
            .collect();

        const bookmarksWithInfo = await Promise.all(
            bookmarks.map(async (bookmark) => {
                const post = await ctx.db.get(bookmark.postId);
                return post;
            })
        );
        return bookmarksWithInfo;
    }
})