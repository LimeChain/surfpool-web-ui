'use client'

import { Avatar } from '@/components/catalyst/avatar'
import { Button } from '@/components/catalyst/button'
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '@/components/catalyst/dialog'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/catalyst/navbar'
import { Sidebar, SidebarHeader } from '@/components/catalyst/sidebar'
import { StackedLayout } from '@/components/catalyst/stacked-layout'
import { useWorkspaceContext } from '@/contexts/workspace-context'
import {
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const getTeams = () => `
  query {
    teams {
      id
      name
    }
  }
`

export function Dashboard({ children }: { children: React.ReactNode }) {
  let workspaceContext = useWorkspaceContext()
  let user = workspaceContext?.data?.user!
  let [isConfirmSignOutOpen, setConfirmSignOutOpen] = useState(false)
  const [teams, setTeams] = useState<any[]>([])
  const [teamName, setTeamName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const pathname = usePathname()

  async function fetchTeams() {
    let nhost = workspaceContext?.helpers.nhostClient!
    let req = getTeams()
    var { data, error } = await nhost.graphql.request(req)
    if (error) {
      console.error({ error })
      return
    }
    setTeams(data.teams)
  }

  useEffect(() => {
    fetchTeams()
  }, [workspaceContext?.data])

  // Create a grapql query to get "teams" and "workspaces" from the user. if there are no teams, we will be displaying 2 inputs in the dialog.


  return (
    <StackedLayout
      path={pathname || '/'}
      navbar={
        <Navbar>
          <NavbarSection className="max-lg:hidden"></NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar src={user?.avatarUrl} square />
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="bottom end">
                <DropdownItem href="#" onClick={() => setConfirmSignOutOpen(true)}>
                  <ArrowRightStartOnRectangleIcon />
                  <DropdownLabel>Sign out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
              <Dialog open={isConfirmSignOutOpen} onClose={setConfirmSignOutOpen} size="xl">
                <DialogTitle>Sign Out?</DialogTitle>
                <DialogDescription>{"You're about to sign out of your account."}</DialogDescription>
                <DialogActions>
                  <Button color="dark" onClick={() => setConfirmSignOutOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="red"
                    onClick={() => {
                      workspaceContext?.helpers.signOut()
                      setConfirmSignOutOpen(false)
                    }}
                  >
                    Sign Out
                  </Button>
                </DialogActions>
              </Dialog>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader></SidebarHeader>
        </Sidebar>
      }
    >
      {children}
    </StackedLayout>
  )
}
