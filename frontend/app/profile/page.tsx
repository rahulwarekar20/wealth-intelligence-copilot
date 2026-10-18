"use client";

/**
 * Profile ("/profile"): the investor profile that personalises the advice,
 * and the other assets that complete the net-worth picture.
 */
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import OtherAssetsCard from "../components/profile/OtherAssetsCard";
import ProfileForm from "../components/profile/ProfileForm";
import { useRequireAuth } from "@/lib/useRequireAuth";

export default function ProfilePage() {
  useRequireAuth();
  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Profile"
          title={<>Advice that fits <span className="italic text-gold-500">you</span></>}
          description="Tell the copilot how you invest and what else you own. Every analysis, alert and answer uses this."
        />
        <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
          <ProfileForm />
          <OtherAssetsCard />
        </div>
      </PageContainer>
    </PageLayout>
  );
}
