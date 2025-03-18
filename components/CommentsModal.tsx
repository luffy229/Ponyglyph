import { View, Text, Modal, KeyboardAvoidingView, Platform, TouchableOpacity, FlatList, TextInput } from 'react-native'
import Comment from './Comment'; // Add this line to import the Comment component
import React, { useState } from 'react'
import { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { styles } from '@/styles/feed.styles'
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { Loader } from './Loader';

type CommentsModal = {
    postId: Id<"posts">;
    visible: boolean;
    onClose: () => void;
    
    
}



export default function CommentsModal({onClose,postId,visible}: CommentsModal) {
    const [newComment, setNewComment] = useState("");
    const comments = useQuery(api.comments.getComments, { postId });
    const addComment = useMutation(api.comments.addComment);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            await addComment({
                content: newComment,
                postId
            });

            setNewComment("");
            

        }catch (error) {
            console.log("Error adding comment:", error)
        }
    }
    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.white} />

                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Comments</Text>
                        <View style={{ width: 24 }}></View>

                    </View>

                    {comments === undefined ? (
                        <Loader />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => <Comment comment={item} />}
                            contentContainerStyle={styles.commentsList}

                        />

                    )}

                    <View style={styles.commentInput}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
                            placeholderTextColor={COLORS.grey}
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                        />
                        <TouchableOpacity onPress={handleAddComment} disabled={!newComment.trim()}>
                            <Text style={[styles.postButton, !newComment.trim() && styles.postButtonDisabled]}>
                                Post
                            </Text>
                        </TouchableOpacity>
                        

                        

                    </View>

            </KeyboardAvoidingView>

        </Modal>
      )

}