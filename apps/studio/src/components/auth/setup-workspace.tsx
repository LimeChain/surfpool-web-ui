import { useState } from "react";
import { Input, Button, Heading, Divider } from "@surfpool/ui";

interface SetupWorkspaceProps {
  onComplete?: (teamName: string, workspaceName: string) => void;
}

export default function SetupWorkspace({ onComplete }: SetupWorkspaceProps) {
  const [teamName, setTeamName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const handleSubmit = () => {
    if (onComplete) {
      onComplete(teamName, workspaceName);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Heading className="text-center">Setup Workspace</Heading>
      <Divider className="my-10 mt-6" soft />

      {/* Team Info Section */}
      <section className="grid gap-y-6">
        <div className="w-full space-y-4">
          <Input
            type="text"
            aria-label="Team Name"
            placeholder="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>
      </section>

      <Divider className="my-10" soft />

      {/* Workspace Name Section */}
      <section className="grid gap-y-6">
        <div className="w-full space-y-4">
          <Input
            type="text"
            aria-label="Workspace Name"
            placeholder="Workspace name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
        </div>
      </section>

      <section className="grid my-10 gap-y-6">
        <div className="flex justify-center gap-4">
          <Button className="w-[320px]" onClick={handleSubmit}>
            Finish
          </Button>
        </div>
      </section>
    </div>
  );
}