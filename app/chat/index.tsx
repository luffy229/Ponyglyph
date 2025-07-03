import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';
import { COLORS } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import { Id } from '@/convex/_generated/dataModel';

export default function ChatListScreen() {
  const router = useRouter();
  const chats = useQuery(api.chat.getChats);
  const following = useQuery(api.users.getFollowing);
  const startChat = useMutation(api.chat.getOrCreateChat);

  const handleStartChat = async (userId: Id<"users">) => {
    try {
      const chatId = await startChat({ otherUserId: userId });
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const renderChatItem = ({ item }: { item: { _id: Id<"chats">; otherUser: { username: string; image: string }; lastMessage: { content: string; createdAt: number } | null; unreadCount: number } }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => router.push(`/chat/${item._id}`)}
    >
      <Image 
        source={{ uri: item.otherUser.image }}
        style={styles.avatar}
      />
      <View style={styles.chatInfo}>
        <Text style={styles.username}>{item.otherUser.username}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage?.content || 'No messages yet'}
        </Text>
      </View>
      <View style={styles.chatMeta}>
        {item.lastMessage && (
          <Text style={styles.timestamp}>
            {formatDistanceToNow(new Date(item.lastMessage.createdAt), { addSuffix: true })}
          </Text>
        )}
        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity>
          <Ionicons name="create-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.followingSection}>
        <Text style={styles.sectionTitle}>Start a Chat</Text>
        <FlatList
          data={following ?? []}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.followingList}
          renderItem={({ item }) => item && (
            <TouchableOpacity 
              style={styles.followingItem}
              onPress={() => handleStartChat(item._id)}
            >
              <Image 
                source={{ uri: item.image }}
                style={styles.followingAvatar}
              />
              <Text style={styles.followingUsername}>{item.username}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item?._id ?? ''}
        />
      </View>

      <FlatList
        data={chats ?? []}
        renderItem={renderChatItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.chatList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  followingSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 12,
  },
  followingList: {
    paddingRight: 16,
  },
  followingItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  followingAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  followingUsername: {
    color: COLORS.white,
    fontSize: 12,
  },
  chatList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.grey,
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 