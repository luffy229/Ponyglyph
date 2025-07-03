import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, TextInput } from 'react-native'
import React, { useState } from 'react'
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { styles } from '@/styles/create.styles';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import * as FileSystem from "expo-file-system"
import { Video, ResizeMode } from 'expo-av';

type MediaItem = {
  uri: string;
  type: 'image' | 'video';
};

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [videoRef, setVideoRef] = useState<Video | null>(null);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newMedia = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'image' ? 'image' as const : 'video' as const
      }));
      setSelectedMedia(prev => [...prev, ...newMedia]);
    }
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const generateUploadUrl = useMutation(api.posts.generateUploadUrl)
  const createPost = useMutation(api.posts.createPost)

  const handleShare = async () => {
    if (selectedMedia.length === 0) return;

    try {
      setIsSharing(true);
      const storageIds = [];

      // Upload all media
      for (const media of selectedMedia) {
        const uploadUrl = await generateUploadUrl();
        
        const uploadResult = await FileSystem.uploadAsync(uploadUrl,
          media.uri, {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            mimeType: media.type === 'image' ? "image/jpeg" : "video/mp4",
          }
        );

        if (uploadResult.status !== 200) throw new Error("Upload failed");
        const { storageId } = JSON.parse(uploadResult.body);
        storageIds.push(storageId);
      }

      // Create post with all uploaded media
      await createPost({
        caption,
        storageIds,
        type: selectedMedia[0].type // Set the type based on the first media item
      });

      setSelectedMedia([]);
      setCaption("");
      router.push("/(tabs)");

    } catch (error) {
      console.log("Error Sharing Posts", error);
    } finally {
      setIsSharing(false);
    }
  }

  if (selectedMedia.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Post</Text>
          <View style={{ width: 28 }}></View>
        </View>

        <TouchableOpacity style={styles.emptyImageContainer} onPress={pickMedia}>
          <Ionicons name="image-outline" size={48} color={COLORS.grey} />
          <Text style={styles.emptyImageText}>Tap to select Media</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              setSelectedMedia([]);
              setCaption("");
            }}
            disabled={isSharing}
          >
            <Ionicons
              name="close-outline"
              size={28}
              color={isSharing ? COLORS.grey : COLORS.white}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity
            style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
            disabled={isSharing || selectedMedia.length === 0}
            onPress={handleShare}
          >
            {isSharing ? (
              <ActivityIndicator size={"small"} color={COLORS.primary} />
            ) : (
              <Text style={styles.shareText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentOffset={{ x: 0, y: 100 }}
        >
          <View style={[styles.content, isSharing && styles.contentDisabled]}>
            <View style={styles.imageSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedMedia.map((media, index) => (
                  <View key={index} style={styles.imageContainer}>
                    {media.type === 'image' ? (
                      <Image
                        source={media.uri}
                        style={styles.previewImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Video
                        ref={(ref: Video | null) => setVideoRef(ref)}
                        source={{ uri: media.uri }}
                        style={styles.previewImage}
                        useNativeControls
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={false}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeMedia(index)}
                      disabled={isSharing}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickMedia}
                disabled={isSharing}
              >
                <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.changeImageText}>Add More</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputSection}>
              <View style={styles.captionContainer}>
                <Image
                  source={user?.imageUrl}
                  style={styles.userAvatar}
                  contentFit="cover"
                  transition={200}
                />
                <TextInput
                  style={styles.captionInput}
                  placeholder="Write a caption..."
                  placeholderTextColor={COLORS.grey}
                  multiline
                  value={caption}
                  onChangeText={setCaption}
                  editable={!isSharing}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}