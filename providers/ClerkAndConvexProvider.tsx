import React from 'react'

import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { tokenCache } from '@/cache';



const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

 // Define tokenCache as an empty object or appropriate value

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
  )
}

export default function ClerkAndConvexProvider({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <ClerkLoaded>
                {children}
            </ClerkLoaded>
            
        </ConvexProviderWithClerk>

     </ClerkProvider>
    )
  }