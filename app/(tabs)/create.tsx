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

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [caption, setCaption] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);


  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1,1],
      quality: 0.8,
    });

    if (!result.canceled) setSelectedImage(result.assets[0].uri);

  };
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl)
  const createPost = useMutation(api.posts.createPost)

  const handleShare = async () => {
    if (!selectedImage) return;

    try {
      setIsSharing(true);
      const uploadUrl = await generateUploadUrl();

      const uploadResult = await FileSystem.uploadAsync(uploadUrl,
        selectedImage, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          mimeType: "image/jpeg",
        }
      )

      if (uploadResult.status !==200 ) throw new Error("Upload failed");

      const { storageId } = JSON.parse(uploadResult.body)
      await createPost({storageId,caption});

      setSelectedImage(null);
      setCaption("");

      router.push("/(tabs)")


    }catch (error) {
      console.log("Error Sharing Posts")

    }finally{
      setIsSharing(false);
    }

  }
  

  if (!selectedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={COLORS.primary} />

          </TouchableOpacity>

          <Text style={styles.headerTitle}>New Post</Text>
          <View style={{ width:28 }}></View>

        </View>

        <TouchableOpacity style={styles.emptyImageContainer}  onPress={pickImage}>
          <Ionicons name="image-outline" size={48} color={COLORS.grey} />
          <Text style={styles.emptyImageText}>Tap to select an Image</Text>

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

        {/*header*/}

        <View style={styles.header}>
          <TouchableOpacity onPress={() =>{
            setSelectedImage(null);
            setCaption("")
          }}
          disabled={isSharing}
          >
            <Ionicons
              name="close-outline"
              size={28}
              color={isSharing ? COLORS.grey : COLORS.white}>

            </Ionicons>

          </TouchableOpacity>

          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity
            style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
            disabled={isSharing || !selectedImage}
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
         contentContainerStyle = {styles.scrollContent}
         bounces = {false}
         keyboardShouldPersistTaps="handled"
         contentOffset={{ x:0 ,y:100}}
         >
          <View style = {[styles.content, isSharing && styles.contentDisabled]}>
            
            {/*image section */}

            <View style={styles.imageSection}>
              <Image
                source={selectedImage}
                style={styles.previewImage}
                contentFit="cover"
                transition={200}
                />
                
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickImage}
                disabled={isSharing}
              >
                <Ionicons name="image-outline" size={20} color={COLORS.white} />
                <Text style={styles.changeImageText}>Change</Text>

              </TouchableOpacity>

            </View>

            {/*input section */}
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
  )
}