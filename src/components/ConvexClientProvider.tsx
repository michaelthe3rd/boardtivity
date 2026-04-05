"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const clerkAppearance = {
  layout: {
    logoImageUrl: "https://boardtivity.com/logo-horizontal.svg",
    logoLinkUrl: "/",
    showOptionalFields: true,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    fontFamily: "'Satoshi', Arial, sans-serif",
    fontFamilyButtons: "'Satoshi', Arial, sans-serif",
    fontSize: "15px",
    borderRadius: "10px",
    colorBackground: "#ffffff",
    colorInputBackground: "#f7f8f9",
    colorInputText: "#111315",
    colorText: "#111315",
    colorTextSecondary: "#888880",
    colorPrimary: "#111315",
    colorDanger: "#c03030",
    spacingUnit: "18px",
  },
  elements: {
    card: {
      boxShadow: "0 32px 80px rgba(0,0,0,.16)",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: "18px",
      padding: "32px",
    },
    headerTitle: {
      fontSize: "22px",
      fontWeight: "800",
      letterSpacing: "-0.03em",
    },
    headerSubtitle: {
      fontSize: "14px",
      opacity: "0.55",
    },
    socialButtonsBlockButton: {
      border: "1px solid rgba(0,0,0,.10)",
      borderRadius: "10px",
      fontWeight: "600",
      fontSize: "14px",
      height: "44px",
    },
    formButtonPrimary: {
      backgroundColor: "#111315",
      borderRadius: "10px",
      fontWeight: "700",
      fontSize: "14px",
      height: "44px",
      letterSpacing: "-0.01em",
      "&:hover": { backgroundColor: "#23262b" },
    },
    formFieldInput: {
      borderRadius: "10px",
      border: "1px solid rgba(0,0,0,.12)",
      fontSize: "14px",
      height: "44px",
      backgroundColor: "#f7f8f9",
    },
    formFieldLabel: {
      fontSize: "13px",
      fontWeight: "600",
      color: "#111315",
    },
    footerActionLink: {
      color: "#111315",
      fontWeight: "700",
    },
    dividerLine: {
      backgroundColor: "rgba(0,0,0,.08)",
    },
    dividerText: {
      color: "#aaa",
      fontSize: "12px",
    },
    identityPreviewText: {
      fontSize: "14px",
    },
    logoBox: {
      height: "40px",
      display: "flex",
      justifyContent: "center",
      marginBottom: "8px",
    },
    logoImage: {
      height: "40px",
      width: "auto",
    },
    header: {
      gap: "4px",
    },
  },
};

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      appearance={clerkAppearance}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
