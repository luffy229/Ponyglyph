import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./utils";
import { Id } from "./_generated/dataModel";

export const createStory = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx);

    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("Image not found");

    // Create story that expires in 24 hours
    const now = Date.now();
    const storyId = await ctx.db.insert("stories", {
      userId: currentUser._id,
      imageUrl,
      storageId: args.storageId,
      views: 0,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
    });

    return storyId;
  },
});

export const getStories = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentUser = await getAuthenticatedUser(ctx);
    
    // Get all users that the current user is following
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", currentUser._id))
      .collect();
    
    const followingIds = following.map(f => f.followingId);
    // Include current user's ID to show their own stories
    followingIds.push(currentUser._id);
    
    // Get all active stories (not expired)
    const stories = await ctx.db
      .query("stories")
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    // Filter stories to only include those from followed users
    const filteredStories = stories.filter(story => 
      followingIds.includes(story.userId)
    );

    // Get user info for each story
    const storiesWithUserInfo = await Promise.all(
      filteredStories.map(async (story) => {
        const user = await ctx.db.get(story.userId);
        if (!user) throw new Error("User not found");

        return {
          ...story,
          author: {
            _id: user._id,
            username: user.username,
            image: user.image,
          },
        };
      })
    );

    // Group stories by user
    const storiesByUser = storiesWithUserInfo.reduce((acc, story) => {
      const userId = story.userId;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(story);
      return acc;
    }, {} as Record<Id<"users">, typeof storiesWithUserInfo>);

    return Object.values(storiesByUser);
  },
});

export const viewStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx);

    // Check if already viewed
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story_user", (q) => 
        q.eq("storyId", args.storyId)
         .eq("userId", currentUser._id)
      )
      .collect();

    if (views.length > 0) {
      return;
    }

    // Add view
    await ctx.db.insert("storyViews", {
      userId: currentUser._id,
      storyId: args.storyId,
      viewedAt: Date.now(),
    });

    // Increment views count
    const story = await ctx.db.get(args.storyId);
    if (story) {
      await ctx.db.patch(args.storyId, {
        views: story.views + 1,
      });
    }
  },
});

export const getViewedStories = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getAuthenticatedUser(ctx);

    // Get all stories viewed by the user
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    return views.map(view => view.storyId);
  },
}); 