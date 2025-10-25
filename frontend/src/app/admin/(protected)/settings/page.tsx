"use client";

import React from "react";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";

export default function SettingsPage() {
  return (
    <div className="space-y-10 w-full">
      <h1 className="text-3xl font-bold text-dark">System Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Brand Configuration */}
        <div className="bg-white border border-accent/15 p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-dark">
            Brand Configuration
          </h2>
          <form className="space-y-6">
            <FormInput
              label="Website Name"
              defaultValue="TutDe Creative Catalog"
            />
            <FormInput label="Sender Email" defaultValue="noreply@tutde.com" />
            <Button variant="primary">
              Save Brand Info
            </Button>
          </form>
        </div>

        {/* Admin Security */}
        <div className="bg-white border border-accent/15 p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-dark">
            Admin Security
          </h2>
          <form className="space-y-6">
            <FormInput label="Current Password" type="password" />
            <FormInput label="New Password" type="password" />
            <FormInput label="Confirm New Password" type="password" />
            <Button variant="danger">
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
