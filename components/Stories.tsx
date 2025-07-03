import React, { useState } from "react";
import Story from "@/components/Story";
import { ScrollView, TouchableOpacity, View, Text, Image } from "react-native";
import { styles } from "../styles/feed.styles";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader } from "./Loader";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import StoryPreview from "./StoryPreview";

const StoriesSection = () => {
  const stories = useQuery(api.stories.getStories);
  const viewedStories = useQuery(api.stories.getViewedStories);
  const createStory = useMutation(api.stories.createStory);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const { user } = useUser();
  const [showYourStories, setShowYourStories] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (stories === undefined || viewedStories === undefined || !user) return <Loader />;

  const handleAddStory = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Error selecting image:", error);
    }
  };

  const handleShareStory = async () => {
    try {
      if (!selectedImage) return;

      // Get upload URL
      const uploadUrl = await generateUploadUrl();
      
      // Upload image
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: await fetch(selectedImage).then(r => r.blob()),
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const { storageId } = await response.json();
      
      // Create story
      await createStory({ storageId });

      // Close preview
      setShowPreview(false);
      setSelectedImage(null);
    } catch (error) {
      console.error("Error sharing story:", error);
    }
  };

  // Process stories by user
  const processedStories = stories.map(userStories => {
    const firstStory = userStories[0];
    return {
      author: firstStory.author,
      stories: userStories.map(story => ({
        _id: story._id,
        imageUrl: story.imageUrl,
        views: story.views,
        createdAt: story.createdAt,
      })),
      hasViewed: userStories.every(story => viewedStories.includes(story._id))
    };
  });

  // Separate current user's stories from others
  const currentUserStories = processedStories.find(
    story => story.author.username === user.username || story.author._id === user.id
  );
  const otherUsersStories = processedStories.filter(
    story => story.author.username !== user.username && story.author._id !== user.id
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.storiesContainer}
        contentContainerStyle={styles.storiesContentContainer}
      >
        {/* Your Story */}
        <TouchableOpacity 
          style={styles.storyWrapper} 
          onPress={() => {
            if (currentUserStories) {
              setShowYourStories(true);
            } else {
              handleAddStory();
            }
          }}
        >
          <View style={[styles.storyRing, !currentUserStories && styles.noStory]}>
            {currentUserStories ? (
              <Image 
                source={{ uri: currentUserStories.stories[currentUserStories.stories.length - 1].imageUrl }} 
                style={styles.storyAvatar} 
              />
            ) : (
              <View style={styles.addStoryButton}>
                <Ionicons name="add" size={24} color={COLORS.white} />
              </View>
            )}
          </View>
          <Text style={styles.storyUsername}>Your story</Text>
        </TouchableOpacity>
        
        {/* Other Users' Stories */}
        {otherUsersStories.map((story) => (
          <Story key={story.author._id} story={story} />
        ))}
      </ScrollView>

      {/* Your Stories Modal */}
      {currentUserStories && showYourStories && (
        <Story 
          story={{
            ...currentUserStories,
            author: {
              ...currentUserStories.author,
              username: "Your story"
            }
          }}
          onClose={() => setShowYourStories(false)}
        />
      )}

      {/* Story Preview Screen */}
      {selectedImage && (
        <StoryPreview
          imageUri={selectedImage}
          isVisible={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedImage(null);
          }}
          onShare={handleShareStory}
        />
      )}
    </>
  );
};

export default StoriesSection;