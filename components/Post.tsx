import { View, Text, TouchableOpacity, Dimensions } from 'react-native'
import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { styles } from '@/styles/feed.styles'
import { Link } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '@/constants/theme'
import { Id } from '@/convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import CommentsModal from './CommentsModal'
import { formatDistanceToNow } from 'date-fns'
import { useUser } from '@clerk/clerk-expo'
import Carousel from 'react-native-reanimated-carousel';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');

type MediaItem = {
    url: string;
    type: 'image' | 'video';
};

type PostProps = {
    post: {
        _id: Id<"posts">;
        imageUrl: string;
        caption?: string;
        likes: number;
        comments: number;
        _creationTime: number;
        isLiked: boolean;
        isBookmarked: boolean;
        type?: 'image' | 'video';
        additionalImages?: Array<{
            imageUrl: string;
            storageId: Id<"_storage">;
        }>;
        author: {
            _id: string;
            username: string;
            image: string;
        };
    };
};

// Memoized Image component
const MemoizedImage = memo(({ url, style }: { url: string; style: any }) => (
    <Image
        source={url}
        style={style}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
    />
));

// Memoized Video component
const MemoizedVideo = memo(({ 
    url, 
    style, 
    isVisible, 
    videoRef 
}: { 
    url: string; 
    style: any; 
    isVisible: boolean;
    videoRef: (ref: Video | null) => void;
}) => {
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setIsPlaying(true);
        } else {
            setIsPlaying(false);
        }
    }, [isVisible]);

    return (
        <Video
            ref={videoRef}
            source={{ uri: url }}
            style={style}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isPlaying}
            isMuted={false}
            onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                    setIsPlaying(status.isPlaying);
                }
            }}
        />
    );
});

// Memoized Post Header
const PostHeader = memo(({ 
    author, 
    currentUserId, 
    onDelete 
}: { 
    author: PostProps['post']['author']; 
    currentUserId?: string;
    onDelete: () => void;
}) => (
    <View style={styles.postHeader}>
        <Link href={
            currentUserId === author._id ? "/(tabs)/profile" : `/user/${author._id}`
        } asChild>
            <TouchableOpacity style={styles.postHeaderLeft}>
                <MemoizedImage url={author.image} style={styles.postAvatar} />
                <Text style={styles.postUsername}>{author.username}</Text>
            </TouchableOpacity>
        </Link>

        {author._id === currentUserId ? (
            <TouchableOpacity onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
        ) : (
            <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.primary} />
            </TouchableOpacity>
        )}
    </View>
));

const Post = ({ post }: PostProps) => {
    const [isLiked, setIsLiked] = useState(post.isLiked);
    const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
    const [showComments, setShowComments] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVideoVisible, setIsVideoVisible] = useState(false);
    const videoRefs = useRef<{ [key: number]: Video | null }>({});

    const { user } = useUser();
    const currentUser = useQuery(api.users.getuserByClerkId, user ? { clerkId: user.id } : "skip");

    const toggleLike = useMutation(api.posts.toggleLike);
    const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
    const deletePost = useMutation(api.posts.deletePost);

    useEffect(() => {
        const currentVideoRef = videoRefs.current[currentIndex];
        if (currentVideoRef) {
            if (isVideoVisible) {
                currentVideoRef.playAsync();
            } else {
                currentVideoRef.pauseAsync();
                currentVideoRef.setPositionAsync(0);
            }
        }
    }, [isVideoVisible, currentIndex]);

    const handleLike = useCallback(async () => {
        try {
            const newIsLiked = await toggleLike({ postId: post._id });
            setIsLiked(newIsLiked);
        } catch (error) {
            console.error("Error toggling Like:", error);
        }
    }, [post._id, toggleLike]);

    const handleBookmark = useCallback(async () => {
        const newIsBookmarked = await toggleBookmark({ postId: post._id });
        setIsBookmarked(newIsBookmarked);
    }, [post._id, toggleBookmark]);

    const handleDelete = useCallback(async () => {
        try {
            await deletePost({ postId: post._id });
        } catch (error) {
            console.error("ERROR Deleting The Post", error);
        }
    }, [post._id, deletePost]);

    // Memoize media items array
    const mediaItems: MediaItem[] = React.useMemo(() => [
        { url: post.imageUrl, type: (post.type || 'image') as 'image' | 'video' },
        ...(post.additionalImages?.map(img => ({ url: img.imageUrl, type: 'image' as const })) || [])
    ], [post.imageUrl, post.type, post.additionalImages]);

    const renderMediaItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
        if (item.type === 'video') {
            return (
                <MemoizedVideo
                    url={item.url}
                    style={styles.postImage}
                    isVisible={isVideoVisible && currentIndex === index}
                    videoRef={(ref: Video | null) => {
                        videoRefs.current[index] = ref;
                    }}
                />
            );
        }

        return <MemoizedImage url={item.url} style={styles.postImage} />;
    }, [isVideoVisible, currentIndex]);

    const handleProgressChange = useCallback((_: number, absoluteProgress: number) => {
        const newIndex = Math.round(absoluteProgress);
        setCurrentIndex(newIndex);
        setIsVideoVisible(mediaItems[newIndex].type === 'video');
    }, [mediaItems]);

    return (
        <View style={styles.post}>
            <PostHeader 
                author={post.author} 
                currentUserId={currentUser?._id} 
                onDelete={handleDelete}
            />

            <View style={styles.imageContainer}>
                <Carousel
                    width={width}
                    height={width}
                    data={mediaItems}
                    loop={false}
                    onProgressChange={handleProgressChange}
                    renderItem={renderMediaItem}
                />
                {mediaItems.length > 1 && (
                    <View style={styles.imageIndicator}>
                        {mediaItems.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.indicatorDot,
                                    currentIndex === index && styles.indicatorDotActive
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.postActions}>
                <View style={styles.postActionsLeft}>
                    <TouchableOpacity onPress={handleLike}>
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={24}
                            color={isLiked ? COLORS.primary : COLORS.white}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowComments(true)}>
                        <Ionicons name="chatbubble-outline" size={22} color={COLORS.white} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleBookmark}>
                    <Ionicons
                        name={isBookmarked ? "bookmark" : "bookmark-outline"}
                        size={22}
                        color={COLORS.primary}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.postInfo}>
                <Text style={styles.likesText}>
                    {post.likes > 0 ? `${post.likes.toLocaleString()} likes` : "Be the first one to like"}
                </Text>
                {post.caption && (
                    <View style={styles.captionContainer}>
                        <Text style={styles.captionUsername}>{post.author.username}</Text>
                        <Text style={styles.captionText}>{post.caption}</Text>
                    </View>
                )}
                {post.comments > 0 && (
                    <TouchableOpacity onPress={() => setShowComments(true)}>
                        <Text style={styles.commentsText}>View all {post.comments} comments</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.timeAgo}>
                    {formatDistanceToNow(post._creationTime, { addSuffix: true })}
                </Text>
            </View>

            <CommentsModal
                postId={post._id}
                visible={showComments}
                onClose={() => setShowComments(false)}
            />
        </View>
    );
};

export default memo(Post);