"use client"

import { Button } from '@surfpool/ui'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '@surfpool/ui'
import { Field, FieldGroup, Fieldset, Label, Legend } from '@surfpool/ui'
import { Heading } from '@surfpool/ui'
import { Input } from '@surfpool/ui'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@surfpool/ui'
import { Select } from '@surfpool/ui'
import { useWorkspaceContext } from '@/contexts/workspace-context'
import { useState } from 'react'

export default function AgentsNavbar() {
  let [isCreateNetworkOpen, setCreateNetworkOpen] = useState(false)
  const workspaceContext = useWorkspaceContext()

  const createNetwork = async () => {
    try {
      const nameInput = document.querySelector('input[name="network_name"]') as HTMLInputElement;
      const descriptionInput = document.querySelector('input[name="network_description"]') as HTMLInputElement;
      const datasourceRpcUrlInput = document.querySelector('input[name="datasource_rpc_url"]') as HTMLInputElement;
      const modeSelect = document.querySelector('select[name="network_mode"]') as HTMLSelectElement;
      
      if (!nameInput || !descriptionInput || !datasourceRpcUrlInput || !modeSelect) {
        throw new Error('Form elements not found');
      }

      const networkPayload = {
        workspace_id: 0,
        name: nameInput.value,
        description: descriptionInput.value,
        datasource_rpc_url: datasourceRpcUrlInput.value || 'https://api.mainnet-beta.solana.com',
        block_production_mode: modeSelect.value,
        status: "Pending"
      };

      let event = new CustomEvent('networkInitializationWillStart', { 
        detail: networkPayload
      });
      window.dispatchEvent(event);
      setCreateNetworkOpen(false);

      let accessToken = "0";

      const response = await fetch('https://svm-cloud-api.txtx.run/v1/surfnets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(networkPayload),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log('Network created:', data);

      event = new CustomEvent('networkInitializationDidSucceed');
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to create network:', error);
    }
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
            <Heading className='mb-4'>Surfnets</Heading>
        </div>
        <Navbar>
            <NavbarSection>
                <NavbarItem href="/networks" current>Overview</NavbarItem>
            </NavbarSection>
            <NavbarSpacer />
            <div className="flex gap-4">
              <Button 
                href="#"
                onClick={() => setCreateNetworkOpen(true)}
                color="emerald">Create Surfnet</Button>
            </div>
        </Navbar>
        <Dialog open={isCreateNetworkOpen} onClose={setCreateNetworkOpen} size="xl">
        <DialogTitle>Create new Network</DialogTitle>
        <DialogDescription>{"You're about to create a new Sufpool simnet Network."}</DialogDescription>
        <DialogBody>
        <Fieldset>
        <FieldGroup>
          <Field>
            <Label>Name</Label>
            <Input name="network_name" placeholder="Pump.fun team network" autoFocus/>
          </Field>
          <Field>
            <Label>Description</Label>
            <Input name="network_description" placeholder="Pump.fun test environment" />
          </Field>
          <Field>
            <Label>Datasource RPC Endpoint</Label>
            <Input name="datasource_rpc_url" placeholder="Default: https://api.mainnet-beta.solana.com" />
          </Field>
          <Field>
            <Label>Block Production Mode</Label>
            <Select name="network_mode">
              <option value="Clock">Produce blocks every 400ms</option>
              <option value="Transaction">Only produce blocks when transactions are received.</option>
              <option value="Manual">Full manual control (via RPC methods / cloud.txtx.run)</option>
            </Select>
          </Field>
          </FieldGroup>
        </Fieldset>
        </DialogBody>
        <DialogActions>
          <Button color='dark' onClick={() => setCreateNetworkOpen(false)}>
            Cancel
          </Button>
          <Button color='emerald' onClick={createNetwork}>Create Surfnet</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
