import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
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

type PostProps =  {
    post: {
        _id:Id<"posts">;
        imageUrl:string;
        caption?: string;
        likes: number;
        comments: number;
        _creationTime: number;
        isLiked: boolean;
        isBookmarked: boolean;
        author: {
            _id: string;
            username: string;
            image: string;
        };
    };

};


export default function Post({post}: PostProps) {
    const [isLiked,setIsLiked] = useState(post.isLiked);
    const [isBookmarked,setIsBookmarked] = useState(post.isBookmarked);
    const [showComments, setShowComments] = useState(false);

    const { user } = useUser();
    
    const currentUser =  useQuery(api.users.getuserByClerkId, user ? {clerkId: user.id} : "skip")

    const toggleLike = useMutation(api.posts.toggleLike);
    const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
    const deletePost = useMutation(api.posts.deletePost);  

    const handleLike = async () => {
        try{
            const newIsLiked = await toggleLike({ postId: post._id});
            setIsLiked(newIsLiked);
           
        } catch (error) {
            console.error("Error toggling Like:", error);
        }
    };

    const handleBookmark = async () => {
        const newIsBookmarked = await toggleBookmark({ postId: post._id});
        setIsBookmarked(newIsBookmarked);
    };

    const handleDelete = async () => {
        try {
            await deletePost({ postId: post._id });
        }catch (error) {
            console.error("ERROR Deleting The Post", error);
        }        

    };


    return (
    <View style= {styles.post}>

        {/* POSt Header */}

        <View style={styles.postHeader}>
            
            <Link href={
                currentUser?._id === post.author._id ? "/(tabs)/profile" : `/user/${post.author._id}`
            } asChild>
            <TouchableOpacity style={styles.postHeaderLeft}>
                <Image
                    source = {post.author.image}
                    style = {styles.postAvatar}
                    contentFit = "cover"
                    transition = {200}
                    cachePolicy = "memory-disk"
                />
                <Text style={styles.postUsername}>{post.author.username}</Text>
            </TouchableOpacity>
            </Link>

            {/* if iam the owner of the post, show the delete button  */}

            {post.author._id === currentUser?._id ? (
                <TouchableOpacity onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.primary}></Ionicons>
                </TouchableOpacity>

            ) : (
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.primary}></Ionicons>
                </TouchableOpacity>


            )}
        </View>

        {/* Image */}

        <Image
        source={post.imageUrl}
        style={styles.postImage}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        >

        </Image>

        {/* PostSection */}

        <View style={styles.postActions}>
            <View style={styles.postActionsLeft}>
                <TouchableOpacity onPress={handleLike}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24}
                     color = {isLiked ? COLORS.primary : COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowComments(true)}>
                    <Ionicons name={"chatbubble-outline"} size={22} color = {COLORS.white} />
                </TouchableOpacity>
            </View>
                
                <TouchableOpacity onPress={handleBookmark}>
                    <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color = {COLORS.primary} />
                </TouchableOpacity>
        </View>

        {/* PostInfo */}

        <View style= {styles.postInfo}>
            <Text style= {styles.likesText}>
                {post.likes > 0 ? `${post.likes.toLocaleString()} likes` : "Be the first one to like"}
            </Text>
                {post.caption  && (
                    <View style= {styles.captionContainer}>
                        <Text style= {styles.captionUsername}>{post.author.username}</Text>
                        <Text style= {styles.captionText}>{post.caption}</Text>
                        </View>
                )}

                {post.comments > 0 && (   
                <TouchableOpacity onPress={() => setShowComments(true)}>
                    <Text style={styles.commentsText}>View all {post.comments} comments</Text>
                </TouchableOpacity>
                )} 
                <Text style= {styles.timeAgo}>{formatDistanceToNow(post._creationTime, { addSuffix: true})}</Text>

        </View>

        <CommentsModal
            postId={post._id}
            visible={showComments}
            onClose={() => setShowComments(false)}
            
        />



        
      
    </View>
  )
}