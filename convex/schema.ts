import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
    users: defineTable({
        username: v.string(),
        fullname: v.string(),
        email: v.string(),
        bio: v.optional(v.string()),
        image: v.string(), 
        followers: v.number(),
        following: v.number(),
        posts: v.number(),
        clerkId: v.string(), 
        lastSeen: v.optional(v.number()),
        isOnline: v.optional(v.boolean()),
    }).index("by_clerk_id", ["clerkId"]),

    posts: defineTable({
        userId: v.id("users"),
        imageUrl: v.string(),
        storageId: v.id("_storage"),
        caption: v.optional(v.string()),
        likes: v.number(),
        comments: v.number(),
        type: v.optional(v.union(v.literal("image"), v.literal("video"))),
        additionalImages: v.optional(v.array(v.object({
            imageUrl: v.string(),
            storageId: v.id("_storage"),
        }))),
    }).index("by_user", ["userId"]),

    likes: defineTable({
        userId: v.id("users"),
        postId: v.id("posts"),
    })
    .index("by_user", ["userId"])
    .index("by_post", ["postId"])
    .index("by_user_post", ["userId", "postId"]),

    comments: defineTable({
        userId: v.id("users"),
        postId: v.id("posts"),
        comment: v.string(),
    })
    .index("by_user", ["userId"])
    .index("by_post", ["postId"]),

    follows: defineTable({
        followerId: v.id("users"),
        followingId: v.id("users"),
    })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_both", ["followerId", "followingId"]),

    notifications: defineTable({
        receiverId: v.id("users"),
        senderId: v.id("users"),
        type: v.union(v.literal("like"), v.literal("comment"), v.literal("follow")),
        postId: v.optional(v.id("posts")),
        commentId: v.optional(v.id("comments")),
    })
    .index("by_receiver", ["receiverId"])
    .index("by_post", ["postId"]),
    
    bookmarks: defineTable({
        userId: v.id("users"),
        postId: v.id("posts"),
    })
    .index("by_user", ["userId"])
    .index("by_post", ["postId"])
    .index("by_user_post", ["userId", "postId"]),   

    stories: defineTable({
        userId: v.id("users"),
        imageUrl: v.string(),
        storageId: v.id("_storage"),
        views: v.number(),
        createdAt: v.number(),
        expiresAt: v.number(),
    })
    .index("by_user", ["userId"])
    .index("by_created", ["createdAt"]),

    storyViews: defineTable({
        userId: v.id("users"),
        storyId: v.id("stories"),
        viewedAt: v.number(),
    })
    .index("by_user", ["userId"])
    .index("by_story", ["storyId"])
    .index("by_story_user", ["storyId", "userId"]),

    chats: defineTable({
        participantIds: v.array(v.id("users")),
        lastMessageAt: v.number(),
        unreadCounts: v.optional(v.array(v.object({
            userId: v.id("users"),
            count: v.number(),
        }))),
    })
    .index("by_participants", ["participantIds"]),

    messages: defineTable({
        content: v.optional(v.string()),
        chatId: v.id("chats"),
        senderId: v.id("users"),
        createdAt: v.number(),
        status: v.optional(v.union(v.literal("sent"), v.literal("delivered"), v.literal("seen"))),
        mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
        mediaUrl: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
    })
    .index("by_chat", ["chatId"])
    .index("by_created", ["createdAt"]),
});