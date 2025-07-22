import React from 'react';
import ChatbotBox from '@/components/ChatbotBox';
import MainGrid from '@/components/MainGrid';
import { Heading } from '@/components/catalyst/heading';

const MainContent = ({ workspace, user }: { workspace: any, user: any }) => (
  <div className="flex-1 flex flex-col">
    <Heading>
      Hello, {user?.displayName} welcome to Surfpool Studio
    </Heading>
    {workspace?.expectedRedirect ? (
      <div className="text-sm font-small uppercase text-zinc-300 mt-8">
        Redirecting to: {workspace?.expectedRedirect}...
      </div>
    ) : (
      <div />
    )}
    <MainGrid /> 
  </div>
);

export default MainContent; 