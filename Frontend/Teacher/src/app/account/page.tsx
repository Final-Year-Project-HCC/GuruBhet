'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BasicInformation } from '@/components/BasicInformation';
import { SubjectManagement } from '@/components/SubjectManagement';
import { TabNavigationLayout, TabItem } from '@/components/TabNavigationLayout';

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState('basic-info');

  // Define the main tabs
  const tabs: TabItem[] = [
    {
      id: 'basic-info',
      label: 'Basic Information',
      description: 'Personal details & KYC documents',
    },
    {
      id: 'subjects',
      label: 'Subject Management',
      description: 'Manage your teaching catalog',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile information and teaching subjects.{' '}
            <Link href="/public-profile" className="text-primary hover:underline font-medium">
              View Public Profile →
            </Link>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TabNavigationLayout
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {/* Tab Content */}
          <div>
            {activeTab === 'basic-info' && <BasicInformation />}
            {activeTab === 'subjects' && <SubjectManagement />}
          </div>
        </TabNavigationLayout>
      </div>
    </div>
  );
}
