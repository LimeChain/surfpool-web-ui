import React from 'react';
import { SlotsGrid } from '@/components/svm/slot-grid';
import Faucet from './svm/faucet';
import ChatbotBox from '@/components/ChatbotBox';

const ExplorerHeader = () => (
  <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8 w-full mt-8 items-start">
    <div className="flex flex-col gap-8 w-full">
      <SlotsGrid />
    </div>
    <div className="w-full -mt-5" style={{ width: 350, minWidth: 350, maxWidth: 350 }}>
      <Faucet />
    </div>
  </div>
);

export default ExplorerHeader; 