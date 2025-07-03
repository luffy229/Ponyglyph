import React, { useState, useEffect, useRef } from "react";
import { styles } from "@/styles/feed.styles";
import { View, Text, Image, TouchableOpacity, Modal, Animated, Dimensions, StatusBar, TouchableWithoutFeedback } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

const PROGRESS_BAR_WIDTH = Dimensions.get("window").width;
const STORY_DURATION = 5000; // 5 seconds

type StoryType = {
    _id: Id<"stories">;
    imageUrl: string;
    views: number;
    createdAt: number;
}

type Story = {
    author: {
        _id: string;
        username: string;
        image: string;
    };
    stories: StoryType[];
    hasViewed?: boolean;
}

type StoryProps = {
    story: Story;
    onClose?: () => void;
}

export default function Story({ story, onClose }: StoryProps) {
    const [showStory, setShowStory] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [hasViewed, setHasViewed] = useState(story.hasViewed || false);
    const progressValue = useRef(new Animated.Value(0)).current;
    const viewStory = useMutation(api.stories.viewStory);
    const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const startTime = useRef<number>(0);
    const pausedAt = useRef<number>(0);
    const isYourStory = story.author.username === "Your story";

    const currentStory = story.stories[currentStoryIndex];

    const handleClose = () => {
        setShowStory(false);
        if (onClose) {
            onClose();
        }
    };

    const startProgress = (fromValue = 0) => {
        progressValue.setValue(fromValue);
        const duration = STORY_DURATION * (1 - fromValue);
        
        progressAnimation.current = Animated.timing(progressValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: false,
        });

        startTime.current = Date.now();
        progressAnimation.current.start(({ finished }) => {
            if (finished && !isPaused) {
                handleStoryComplete();
            }
        });
    };

    const handleStoryComplete = () => {
        if (currentStoryIndex < story.stories.length - 1) {
            // Move to next story
            setCurrentStoryIndex(prev => prev + 1);
            progressValue.setValue(0);
        } else {
            // Close modal when all stories are viewed
            handleClose();
            setCurrentStoryIndex(0);
        }
    };

    const handlePause = () => {
        if (!isPaused) {
            if (progressAnimation.current) {
                progressAnimation.current.stop();
                const elapsedTime = Date.now() - startTime.current;
                pausedAt.current = elapsedTime / STORY_DURATION;
            }
        } else {
            startProgress(pausedAt.current);
        }
        setIsPaused(!isPaused);
    };

    const handleTapStory = (event: any) => {
        const screenWidth = Dimensions.get('window').width;
        const tapX = event.nativeEvent.locationX;

        if (tapX < screenWidth * 0.3) {
            // Tapped left side - go to previous story
            if (currentStoryIndex > 0) {
                setCurrentStoryIndex(prev => prev - 1);
            }
        } else if (tapX > screenWidth * 0.7) {
            // Tapped right side - go to next story
            if (currentStoryIndex < story.stories.length - 1) {
                setCurrentStoryIndex(prev => prev + 1);
            } else {
                setShowStory(false);
                setCurrentStoryIndex(0);
            }
        }
    };

    const handleViewStory = async () => {
        try {
            await viewStory({ storyId: currentStory._id });
            setHasViewed(true);
            setShowStory(true);
            startTime.current = Date.now();
            pausedAt.current = 0;
        } catch (error) {
            console.error("Error viewing story:", error);
        }
    };

    const handleAddStory = () => {
        // Implementation of handleAddStory function
    };

    useEffect(() => {
        if (showStory && !isPaused) {
            StatusBar.setHidden(true);
            startProgress();
        } else if (!showStory) {
            StatusBar.setHidden(false);
            if (progressAnimation.current) {
                progressAnimation.current.stop();
            }
            setIsPaused(false);
            progressValue.setValue(0);
            setCurrentStoryIndex(0);
        }
        return () => {
            StatusBar.setHidden(false);
            if (progressAnimation.current) {
                progressAnimation.current.stop();
            }
            setIsPaused(false);
            progressValue.setValue(0);
        };
    }, [showStory, isPaused, currentStoryIndex]);

    return (
        <>
            <TouchableOpacity 
                style={styles.storyWrapper} 
                onPress={isYourStory ? handleAddStory : handleViewStory}
            >
                <View style={[
                    styles.storyRing, 
                    hasViewed && !isYourStory && styles.viewedStory
                ]}>
                    <Image 
                        source={{ uri: story.author.image }} 
                        style={styles.storyAvatar} 
                    />
                </View>
                <Text style={styles.storyUsername}>{story.author.username}</Text>
            </TouchableOpacity>

            <Modal
                visible={showStory}
                transparent={true}
                animationType="fade"
                statusBarTranslucent
                onRequestClose={handleClose}
            >
                <View style={styles.storyModalContainer}>
                    {/* Progress Bars */}
                    <View style={styles.progressBarContainer}>
                        {story.stories.map((s, index) => (
                            <View key={s._id} style={styles.progressBar}>
                                <Animated.View 
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: index === currentStoryIndex 
                                                ? progressValue.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0%', '100%'],
                                                })
                                                : index < currentStoryIndex 
                                                    ? '100%' 
                                                    : '0%',
                                        },
                                    ]}
                                />
                            </View>
                        ))}
                    </View>

                    {/* User Info */}
                    <View style={styles.storyHeader}>
                        <View style={styles.storyHeaderLeft}>
                            <Image 
                                source={{ uri: story.author.image }} 
                                style={styles.storyHeaderAvatar} 
                            />
                            <View>
                                <Text style={styles.storyHeaderUsername}>
                                    {isYourStory ? "Your story" : story.author.username}
                                </Text>
                                <Text style={styles.storyHeaderTime}>
                                    {formatDistanceToNow(currentStory.createdAt, { addSuffix: true })}
                                </Text>
                            </View>
                        </View>
                        {isYourStory && (
                            <TouchableOpacity 
                                style={styles.addStoryButton} 
                                onPress={() => {
                                    handleClose();
                                    handleAddStory();
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={28} color={COLORS.white} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Story Image with Touch Handlers */}
                    <TouchableWithoutFeedback 
                        onPress={handleTapStory}
                        onLongPress={handlePause}
                        onPressOut={() => isPaused && handlePause()}
                    >
                        <View style={styles.storyImageContainer}>
                            <Image
                                source={{ uri: currentStory.imageUrl }}
                                style={styles.storyModalImage}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </Modal>
        </>
    );
}