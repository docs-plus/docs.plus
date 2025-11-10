import React, { useState, useCallback } from 'react'
import Button from '../../../../ui/Button'
import TabTitle from '../components/TabTitle'
import TabSection from '../components/TabSection'
import AvatarSection from '../sections/AvatarSection'
import AccountInfoSection from '../sections/AccountInfoSection'
import AboutSection from '../sections/AboutSection'
import SocialLinksSection from '../sections/SocialLinksSection'
import { useProfileUpdate } from '../hooks/useProfileUpdate'

const ProfileTab = ({ goBack }: { goBack: () => void }) => {
  const { loading, handleSave } = useProfileUpdate()

  return (
    <div className="relative overflow-auto border-gray-300 md:border-l">
      <TabTitle className="flex flex-row items-center" goBack={goBack} title="">
        <Button
          className="btn btn-outline ml-auto md:hidden"
          loading={loading}
          onClick={handleSave}>
          Submit
        </Button>
      </TabTitle>

      <div className="relative h-[30rem] overflow-y-auto">
        <TabSection name="Profile Picture">
          <AvatarSection />
        </TabSection>
        <TabSection name="Account Information">
          <AccountInfoSection />
        </TabSection>
        <TabSection name="About">
          <AboutSection />
        </TabSection>
        <TabSection
          name="Connect & Social Links"
          description="Add your social media profiles, other links, and phone numbers so others can connect with you and you can grow your network!">
          <SocialLinksSection />
        </TabSection>
      </div>
      <div className="sticky bottom-0 z-10 hidden flex-row-reverse border-t border-gray-300 bg-white pt-4 md:flex">
        <Button className="btn-primary !w-40 text-white" loading={loading} onClick={handleSave}>
          Submit
        </Button>
      </div>
    </div>
  )
}

export default ProfileTab
