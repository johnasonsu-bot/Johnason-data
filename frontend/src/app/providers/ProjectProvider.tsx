import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchMyProjects } from "../../services/projects";
import { consumeApplyDefaultProjectOnLogin, getSelectedProjectId, setSelectedProjectId } from "../../services/projectContext";
import type { ProjectSpaceRecord } from "../../types/api";
import { useAuth } from "./AuthProvider";

interface ProjectContextValue {
  projects: ProjectSpaceRecord[];
  currentProject: ProjectSpaceRecord | null;
  currentProjectId: number | null;
  loading: boolean;
  switchProject: (projectId: number) => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<ProjectSpaceRecord[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<number | null>(() => getSelectedProjectId());
  const [loading, setLoading] = useState(false);

  const currentProject = useMemo(
    () => projects.find((item) => item.id === currentProjectId) || projects[0] || null,
    [projects, currentProjectId]
  );

  async function refreshProjects() {
    if (!token || !isAuthenticated) {
      setProjects([]);
      setCurrentProjectIdState(null);
      setSelectedProjectId(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchMyProjects(token);
      const rows = response.data || [];
      const storedId = getSelectedProjectId();
      const defaultProjectId = Number(response.meta?.defaultProjectId || 0) || null;
      const defaultProject = consumeApplyDefaultProjectOnLogin() && defaultProjectId
        ? rows.find((item) => item.id === defaultProjectId)
        : null;
      const matched = defaultProject || rows.find((item) => item.id === storedId) || rows[0] || null;
      setProjects(rows);
      setCurrentProjectIdState(matched?.id || null);
      setSelectedProjectId(matched?.id || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshProjects().catch(() => {
      setProjects([]);
      setCurrentProjectIdState(null);
      setSelectedProjectId(null);
    });
  }, [token, isAuthenticated]);

  function switchProject(projectId: number) {
    setCurrentProjectIdState(projectId);
    setSelectedProjectId(projectId);
    window.dispatchEvent(new CustomEvent("medata-project-changed", { detail: { projectId } }));
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        currentProjectId: currentProject?.id || currentProjectId,
        loading,
        switchProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
