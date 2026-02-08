import ProjectSelector from "@/components/ProjectSelector";

// MOCK: API'den gelecek örnek projeler
const userProjects = [
  { id: 1, name: "Proje A" },
  { id: 2, name: "Proje B" },
];

export default function ProjectSelectPage() {
  const handleProjectSelect = (projectId) => {
    alert("Seçili Proje ID: " + projectId);
    // Burada yönlendirme veya context güncellemesi yapılabilir
  };

  return (
    <ProjectSelector projects={userProjects} onSelect={handleProjectSelect} />
  );
} 