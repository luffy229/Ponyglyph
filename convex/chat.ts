import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./users";

// Get total unread messages count for the current user
export const getUnreadCount = query({
  handler: async (ctx) => {
    const currentUser = await getAuthenticatedUser(ctx);
    
    const chats = await ctx.db
      .query("chats")
      .collect();

    const userChats = chats.filter(chat => 
      chat.participantIds.includes(currentUser._id)
    );

    return userChats.reduce((total, chat) => {
      const userUnread = chat.unreadCounts?.find(u => u.userId === currentUser._id);
      return total + (userUnread?.count ?? 0);
    }, 0);
  },
});

// Get all chats for the current user
export const getChats = query({
  handler: async (ctx) => {
    const currentUser = await getAuthenticatedUser(ctx);
    
    // Get all chats where the current user is a participant
    const chats = await ctx.db
      .query("chats")
      .collect();

    // Filter chats where the current user is a participant
    const userChats = chats.filter(chat => 
      chat.participantIds.includes(currentUser._id)
    );

    // Get the other participant's info for each chat
    const chatsWithUserInfo = await Promise.all(
      userChats.map(async (chat) => {
        const otherParticipantId = chat.participantIds.find(id => id !== currentUser._id);
        if (!otherParticipantId) throw new Error("No other participant found");

        const otherUser = await ctx.db.get(otherParticipantId);
        if (!otherUser) throw new Error("User not found");

        // Get the last message for this chat
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .order("desc")
          .first();

        const userUnread = chat.unreadCounts?.find(u => u.userId === currentUser._id);

        return {
          ...chat,
          otherUser: {
            _id: otherUser._id,
            username: otherUser.username,
            image: otherUser.image,
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
          } : null,
          unreadCount: userUnread?.count ?? 0,
        };
      })
    );

    return chatsWithUserInfo;
  },
});

// Mark messages as read
export const markMessagesAsRead = mutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    // Mark all messages from other participants as seen
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const message of messages) {
      if (message.senderId !== user._id) {
        await ctx.db.patch(message._id, {
          status: "seen",
        });
      }
    }

    // Reset unread count for the current user
    await ctx.db.patch(args.chatId, {
      unreadCounts: chat.unreadCounts?.map((count) => ({
        userId: count.userId,
        count: count.userId === user._id.toString() ? 0 : count.count,
      })) || [],
    });
  },
});

// Get messages for a specific chat
export const getMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .collect();

    // Instead of marking as delivered here (since we can't mutate in a query),
    // we'll just return the messages and handle delivery status in a separate mutation
    return messages.map((message) => ({
      ...message,
      isSender: message.senderId === user._id,
    }));
  },
});

// New mutation to mark messages as delivered
export const markMessagesAsDelivered = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    // Mark messages as delivered
    for (const message of messages) {
      if (message.senderId !== user._id && message.status === "sent") {
        await ctx.db.patch(message._id, {
          status: "delivered",
        });
      }
    }
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    // Create the message with initial "sent" status
    const message = await ctx.db.insert("messages", {
      content: args.content,
      chatId: args.chatId,
      senderId: user._id,
      createdAt: Date.now(),
      status: "sent",
    });

    // Update unread counts for other participants
    const otherParticipants = chat.participantIds.filter(
      (id) => id !== user._id.toString()
    );

    await ctx.db.patch(args.chatId, {
      lastMessageAt: Date.now(),
      unreadCounts: chat.unreadCounts?.map((count) => ({
        userId: count.userId,
        count:
          otherParticipants.includes(count.userId)
            ? (count.count || 0) + 1
            : count.count || 0,
      })) || [],
    });

    return message;
  },
});

// Send a message with media
export const sendMediaMessage = mutation({
  args: {
    chatId: v.id("chats"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    // Get the URL for the uploaded media
    const mediaUrl = (await ctx.storage.getUrl(args.storageId)) ?? "";

    // Create the message with media
    const message = await ctx.db.insert("messages", {
      content: args.caption,
      chatId: args.chatId,
      senderId: user._id,
      createdAt: Date.now(),
      status: "sent",
      mediaType: args.mediaType,
      mediaUrl,
      storageId: args.storageId,
    });

    // Update unread counts for other participants
    const otherParticipants = chat.participantIds.filter(
      (id) => id !== user._id.toString()
    );

    await ctx.db.patch(args.chatId, {
      lastMessageAt: Date.now(),
      unreadCounts: chat.unreadCounts?.map((count) => ({
        userId: count.userId,
        count:
          otherParticipants.includes(count.userId)
            ? (count.count || 0) + 1
            : count.count || 0,
      })) || [],
    });

    return message;
  },
});

// Generate upload URL for media
export const generateUploadUrl = mutation({
  args: { type: v.union(v.literal("image"), v.literal("video")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Generate the upload URL
    const uploadUrl = await ctx.storage.generateUploadUrl();

    // The storage ID is the last part of the URL
    const storageId = uploadUrl.split('/').pop() as Id<"_storage">;

    return {
      uploadUrl,
      storageId,
    };
  },
});

// Create or get a chat with another user
export const getOrCreateChat = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx);
    
    // Verify the other user exists
    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) throw new Error("Other user not found");

    // Check if they are following each other
    const isFollowing = await ctx.db
      .query("follows")
      .withIndex("by_both", (q) => 
        q.eq("followerId", currentUser._id).eq("followingId", args.otherUserId)
      )
      .first();

    if (!isFollowing) {
      throw new Error("You can only chat with users you follow");
    }

    // Check if a chat already exists between these users
    const chats = await ctx.db
      .query("chats")
      .collect();

    const existingChat = chats.find(chat => 
      chat.participantIds.includes(currentUser._id) && 
      chat.participantIds.includes(args.otherUserId)
    );

    if (existingChat) {
      return existingChat._id;
    }

    // Create a new chat
    return await ctx.db.insert("chats", {
      participantIds: [currentUser._id, args.otherUserId],
      lastMessageAt: Date.now(),
      unreadCounts: [
        { userId: currentUser._id, count: 0 },
        { userId: args.otherUserId, count: 0 },
      ],
    });
  },
});

// Update user's online status
export const updateOnlineStatus = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    // Update user's online status and last seen
    await ctx.db.patch(user._id, {
      isOnline: true,
      lastSeen: Date.now(),
    });
  },
});

// Update user's offline status
export const updateOfflineStatus = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject)
      )
      .first();
    if (!user) throw new Error("Unauthenticated");

    // Update user's online status and last seen
    await ctx.db.patch(user._id, {
      isOnline: false,
      lastSeen: Date.now(),
    });
  },
});

// Get user's online status
export const getUserOnlineStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // If the user was active in the last 5 minutes, consider them online
    const isOnline = user.isOnline && user.lastSeen && (Date.now() - user.lastSeen < 5 * 60 * 1000);
    
    return {
      isOnline,
      lastSeen: user.lastSeen,
    };
  },
}); 