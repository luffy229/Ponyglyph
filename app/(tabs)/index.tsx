
import { COLORS } from "@/constants/theme";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../../styles/feed.styles";

import { Loader } from "@/components/Loader";
import Post from "@/components/Post";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import StoriesSection from "../../components/Stories";
import { useState } from "react";

export default function Index() {
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  const posts = useQuery(api.posts.getFeedPosts)

  if(posts === undefined) return <Loader />

  if(posts.length === 0) return <NoPostsFound />

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
    

  }

  return (
    <View style={styles.container}>
      {/* Header */}

      <View style= {styles.header}>
        <Text style={styles.headerTitle}>Poneglyph</Text>
        <TouchableOpacity onPress={() => confirmLogout(signOut)}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.primary}></Ionicons>

        </TouchableOpacity>

      </View>

      <FlatList
      data={posts}
      renderItem={({item}) => <Post post={item} /> }
      keyExtractor={(item) => item._id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}
      ListHeaderComponent={<StoriesSection />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
      />
    </View>
  );
}






const NoPostsFound = () => (
  <View
    style={{
      flex: 1,
      backgroundColor: COLORS.background,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <Text style={{ fontSize: 20, color: COLORS.primary, }}>
      No Posts Yet

    </Text>

  </View>
);

const confirmLogout = (signOut: () => void) => {
  Alert.alert(
    "Logout",
    "Are you sure you want to logout?",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: signOut, style: "destructive" }
    ]
  );
};
