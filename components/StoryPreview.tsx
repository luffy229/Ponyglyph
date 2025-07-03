import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StatusBar, Image, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { styles } from '@/styles/story.styles';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import { captureRef } from 'react-native-view-shot';
import ViewShot from 'react-native-view-shot';

type StoryPreviewProps = {
  imageUri: string;
  isVisible: boolean;
  onClose: () => void;
  onShare: () => Promise<void>;
};

type EditingMode = 'text' | 'brush' | 'sticker' | 'location' | 'music' | null;

export default function StoryPreview({ imageUri, isVisible, onClose, onShare }: StoryPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [editingMode, setEditingMode] = useState<EditingMode>(null);
  const [text, setText] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [location, setLocation] = useState<string | null>(null);
  const viewShotRef = React.useRef(null);

  const handleShare = async () => {
    setIsLoading(true);
    try {
      await onShare();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const uri = await captureRef(viewShotRef, {
          format: 'jpg',
          quality: 1,
        });
        await MediaLibrary.saveToLibraryAsync(uri);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address[0]) {
          setLocation(`${address[0].city || ''}, ${address[0].country || ''}`);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      statusBarTranslucent
    >
      <StatusBar backgroundColor="black" barStyle="light-content" />
      <ViewShot ref={viewShotRef} style={styles.previewContainer}>
        {/* Top Bar */}
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={onClose} style={styles.previewHeaderButton}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.previewHeaderActions}>
            <TouchableOpacity 
              style={[styles.previewHeaderButton, editingMode === 'text' && styles.activeButton]}
              onPress={() => setEditingMode(editingMode === 'text' ? null : 'text')}
            >
              <Ionicons name="text" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.previewHeaderButton, editingMode === 'brush' && styles.activeButton]}
              onPress={() => setEditingMode(editingMode === 'brush' ? null : 'brush')}
            >
              <Ionicons name="brush" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.previewHeaderButton}
              onPress={handleDownload}
            >
              <Ionicons name="download" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Preview */}
        <View style={styles.previewImageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.previewImage}
            resizeMode="contain"
          />
          {editingMode === 'text' && (
            <TextInput
              style={[styles.textInput, { top: textPosition.y, left: textPosition.x }]}
              placeholder="Type something..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
            />
          )}
          {location && (
            <View style={styles.locationTag}>
              <Ionicons name="location" size={20} color={COLORS.white} />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          )}
        </View>

        {/* Bottom Bar */}
        <View style={styles.previewFooter}>
          <TouchableOpacity 
            style={[styles.previewFooterButton, editingMode === 'sticker' && styles.activeButton]}
            onPress={() => setEditingMode(editingMode === 'sticker' ? null : 'sticker')}
          >
            <Ionicons name="happy" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.previewFooterButton, location && styles.activeButton]}
            onPress={handleLocation}
          >
            <Ionicons name="location" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.previewFooterButton, editingMode === 'music' && styles.activeButton]}
            onPress={() => setEditingMode(editingMode === 'music' ? null : 'music')}
          >
            <Ionicons name="musical-notes" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.shareButton, isLoading && styles.shareButtonDisabled]} 
            onPress={handleShare}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.shareButtonText}>Share to Story</Text>
            )}
          </TouchableOpacity>
        </View>
      </ViewShot>
    </Modal>
  );
} 