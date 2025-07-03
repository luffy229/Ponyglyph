import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, KeyboardAvoidingView, Platform, Modal, Dimensions } from 'react-native';
import { COLORS } from '@/constants/theme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import { Id } from '@/convex/_generated/dataModel';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');
const MAX_MEDIA_WIDTH = width * 0.7;

const OnlineStatus = ({ userId }: { userId: Id<"users"> }) => {
  const status = useQuery(api.chat.getUserOnlineStatus, { userId });
  
  if (!status) return null;

  if (status.isOnline) {
    return (
      <Text style={styles.onlineStatus}>Active now</Text>
    );
  }

  if (status.lastSeen) {
    return (
      <Text style={styles.lastSeenStatus}>
        Active {formatDistanceToNow(status.lastSeen, { addSuffix: true })}
      </Text>
    );
  }

  return null;
};

const MessageStatus = ({ status, isSender }: { status: 'sent' | 'delivered' | 'seen'; isSender: boolean }) => {
  if (!isSender) return null;

  const getTickColor = () => {
    switch (status) {
      case 'seen':
        return COLORS.primary;
      default:
        return COLORS.grey;
    }
  };

  return (
    <View style={styles.messageStatus}>
      {status === 'sent' ? (
        <Ionicons name="checkmark" size={12} color={getTickColor()} />
      ) : (
        <>
          <Ionicons name="checkmark" size={12} color={getTickColor()} style={styles.doubleTick} />
          <Ionicons name="checkmark" size={12} color={getTickColor()} style={[styles.doubleTick, styles.secondTick]} />
        </>
      )}
    </View>
  );
};

const MediaMessage = ({ mediaUrl, mediaType }: { mediaUrl: string, mediaType: 'image' | 'video' }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const videoRef = useRef<Video>(null);

  if (mediaType === 'image') {
    return (
      <>
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <Image
            source={{ uri: mediaUrl }}
            style={styles.messageMedia}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <Modal
          visible={isModalVisible}
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsModalVisible(false)}
          >
            <Image
              source={{ uri: mediaUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  return (
    <TouchableOpacity onPress={() => videoRef.current?.playAsync()}>
      <Video
        ref={videoRef}
        source={{ uri: mediaUrl }}
        style={styles.messageMedia}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping
      />
    </TouchableOpacity>
  );
};

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const chatId = id as Id<"chats">;
  
  const messages = useQuery(api.chat.getMessages, { chatId });
  const chat = useQuery(api.chat.getChats)?.find(c => c._id === chatId);
  const sendMessage = useMutation(api.chat.sendMessage);
  const sendMediaMessage = useMutation(api.chat.sendMediaMessage);
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl);
  const markAsRead = useMutation(api.chat.markMessagesAsRead);
  const markAsDelivered = useMutation(api.chat.markMessagesAsDelivered);
  const updateOnlineStatus = useMutation(api.chat.updateOnlineStatus);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Update online status when the chat is opened
  useEffect(() => {
    updateOnlineStatus();
    
    // Set up an interval to update online status every minute
    const interval = setInterval(() => {
      updateOnlineStatus();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Mark messages as read when the chat is opened
  useEffect(() => {
    if (chatId) {
      markAsRead({ chatId });
    }
  }, [chatId]);

  // Mark messages as delivered when they are fetched
  useEffect(() => {
    if (chatId && messages) {
      markAsDelivered({ chatId });
    }
  }, [chatId, messages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    try {
      await sendMessage({
        chatId,
        content: message.trim(),
      });
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleMediaUpload = async (file: Blob, type: 'image' | 'video') => {
    try {
      console.log('Generating upload URL...');
      const result = await generateUploadUrl({ type });
      if (!result) {
        throw new Error("Failed to generate upload URL");
      }
      console.log('Upload URL generated:', result.uploadUrl);
      console.log('Storage ID:', result.storageId);
      
      console.log('Starting upload...');
      const uploadResult = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": type === 'image' ? "image/jpeg" : "video/mp4",
        },
      });

      if (!uploadResult.ok) {
        const errorText = await uploadResult.text();
        console.error('Upload failed with status:', uploadResult.status);
        console.error('Upload failed with status text:', uploadResult.statusText);
        console.error('Upload failed with response:', errorText);
        throw new Error(`Failed to upload media: ${uploadResult.status} ${uploadResult.statusText}`);
      }

      console.log('Upload successful, waiting for processing...');
      // Wait a moment for the upload to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Sending media message...');
      await sendMediaMessage({
        chatId,
        storageId: result.storageId,
        mediaType: type,
      });
      console.log('Media message sent successfully');
    } catch (error) {
      console.error('Failed to send media:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      // You might want to show an error message to the user here
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const type = result.assets[0].type === 'video' ? 'video' : 'image';
        await handleMediaUpload(blob, type);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  const renderMessage = ({ item }: { item: { 
    _id: Id<"messages">; 
    content?: string; 
    createdAt: number; 
    isSender: boolean; 
    status?: 'sent' | 'delivered' | 'seen';
    mediaType?: 'image' | 'video';
    mediaUrl?: string;
  } }) => (
    <View style={[styles.messageContainer, item.isSender ? styles.sentMessage : styles.receivedMessage]}>
      {item.mediaUrl && item.mediaType && (
        <MediaMessage mediaUrl={item.mediaUrl} mediaType={item.mediaType} />
      )}
      {item.content && (
        <Text style={[styles.messageText, item.isSender ? styles.sentMessageText : styles.receivedMessageText]}>
          {item.content}
        </Text>
      )}
      <View style={styles.messageFooter}>
        <Text style={styles.timestamp}>
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </Text>
        <MessageStatus status={item.status || 'sent'} isSender={item.isSender} />
      </View>
    </View>
  );

  if (!chat) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to media library</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.userInfo} 
            onPress={() => router.push({
              pathname: "/user/[id]",
              params: { id: chat.otherUser._id }
            })}
          >
            <Image 
              source={{ uri: chat.otherUser.image }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.username}>{chat.otherUser.username}</Text>
              <OnlineStatus userId={chat.otherUser._id as Id<"users">} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="call" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="videocam" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={messages ?? []}
        renderItem={renderMessage}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.messagesList}
        inverted
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={COLORS.grey}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity 
          style={styles.mediaButton}
          onPress={handleImagePick}
        >
          <Ionicons name="image" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSend}
        >
          <Ionicons name="send" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  onlineStatus: {
    color: '#4CAF50',
    fontSize: 12,
  },
  lastSeenStatus: {
    color: COLORS.grey,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 8,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: COLORS.white,
  },
  receivedMessageText: {
    color: COLORS.white,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.grey,
    marginRight: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doubleTick: {
    position: 'absolute',
    right: 0,
  },
  secondTick: {
    right: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: COLORS.white,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  mediaButton: {
    marginHorizontal: 8,
  },
  sendButton: {
    marginLeft: 8,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    marginLeft: 12,
  },
  messageMedia: {
    width: MAX_MEDIA_WIDTH,
    height: MAX_MEDIA_WIDTH * 0.75,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: width * 0.9,
    height: width * 0.9,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
}); 