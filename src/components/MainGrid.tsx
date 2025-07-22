import React from 'react';
import { SlotsGrid } from '@/components/svm/slot-grid';
import Faucet from './svm/faucet';
import ChatbotBox from '@/components/ChatbotBox';

const MainGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-8 items-start">
    <div className="flex flex-col gap-8 max-w-lg w-full">
      <SlotsGrid />
      <ChatbotBox />
    </div>
    <div className="w-full">
      <Faucet />
    </div>
  </div>
);

export default MainGrid; 