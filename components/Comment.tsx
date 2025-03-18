import { styles } from "@/styles/feed.styles";
import { View, Image, Text } from "react-native";
import { formatDistanceToNow } from "date-fns"

interface Comment {
    comment: string;
    _creationTime: number;
    user: {
        fullname: string;
        image: string;
    };
}

export default function Comment({ comment }: { comment: Comment}) {
    return (
        <View style={styles.commentContainer}>
            <Image source={{ uri: comment.user.image }} style={styles.commentAvatar} />
            <View style={styles.commentContent}>
                <Text style={styles.commentUsername}>{comment.user.fullname}</Text>
                <Text style={styles.commentsText}>{comment.comment}</Text>
                <Text style={styles.commentTime}>
                    {formatDistanceToNow(comment._creationTime, { addSuffix:true })}
                </Text>

            </View>
            
        </View>
    )

}