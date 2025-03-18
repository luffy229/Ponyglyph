import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import InitialLayout from "@/components/InitialLayout";
import ClerkAndConvexProvider from "@/providers/ClerkAndConvexProvider";
import { SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import { useCallback, useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar"
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "JetBrainsMono-Medium" : require("..//assets/fonts/JetBrainsMono-Medium.ttf")
  });

  const onLayoutRootView = useCallback(async () => {
    if(fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    if(Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync("#000000");
      NavigationBar.setButtonStyleAsync("light");

    }
  }, []);
  
  return (
    <ClerkAndConvexProvider>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}
          onLayout={onLayoutRootView}>
            <InitialLayout />
          </SafeAreaView>
        </SafeAreaProvider>
        <StatusBar style="light"/>
    </ClerkAndConvexProvider>

    
  );
}
