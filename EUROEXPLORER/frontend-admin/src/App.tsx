import React, { useEffect, useState } from 'react';

type Commit = {
  _id: str;
  country_id: string;
  author_id: string;
  author_name: string;
  status: string;
  diff: any;
  created_at: string;
};

function App() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const [activeUserTab, setActiveUserTab] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      fetch('http://localhost:8000/api/commits', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => setCommits(data))
      .catch(console.error);
    }
  }, []);

  const handleApprove = async (id: string) => {
    await fetch(`http://localhost:8000/api/commits/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    window.location.reload();
  };

  const handleReject = async (id: string) => {
    if(!rejectNote) return alert("Justificação obrigatória");
    await fetch(`http://localhost:8000/api/commits/${id}/reject`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ note: rejectNote })
    });
    window.location.reload();
  };

  const pendingCommits = commits.filter(c => c.status === 'PENDING');
  
  // Group by standard admin
  const adminsWithPending = Array.from(new Set(pendingCommits.map(c => c.author_name)));

  const commitsToShow = activeUserTab 
    ? commits.filter(c => c.author_name === activeUserTab)
    : commits;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="bg-gray-800 p-6 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-eu-gold font-bold">Europa Explorer</h1>
          <p className="text-gray-400">Dashboard de Administração Superior</p>
        </div>
        <div className="text-right">
          <p className="text-lg">Bem-vindo, <span className="text-eu-gold font-bold">Admin</span>!</p>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 min-h-screen p-4 border-r border-gray-700">
          <h3 className="text-gray-400 uppercase text-xs tracking-widest mb-4">Editores</h3>
          <ul>
            <li 
              className={`p-3 rounded cursor-pointer mb-2 ${!activeUserTab ? 'bg-eu-blue' : 'hover:bg-gray-700'}`}
              onClick={() => setActiveUserTab(null)}
            >
              Todos os Logs
            </li>
            {adminsWithPending.map(admin => {
              const count = pendingCommits.filter(c => c.author_name === admin).length;
              return (
                <li 
                  key={admin}
                  onClick={() => setActiveUserTab(admin)}
                  className={`p-3 rounded cursor-pointer mb-2 flex justify-between items-center ${activeUserTab === admin ? 'bg-eu-blue' : 'hover:bg-gray-700'}`}
                >
                  {admin}
                  {count > 0 && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{count}+</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <h2 className="text-2xl mb-6 border-b border-gray-700 pb-2">
            {activeUserTab ? `Propostas de ${activeUserTab}` : 'Visão Geral de Alterações Recentes'}
          </h2>
          
          <div className="grid gap-6">
            {commitsToShow.map(c => (
              <div key={c._id} className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-eu-gold">
                    {c.country_id} <span className="text-sm text-gray-400 font-normal">({new Date(c.created_at).toLocaleString()})</span>
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm ${c.status === 'PENDING' ? 'bg-yellow-600' : c.status === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {c.status}
                  </span>
                </div>
                
                <p className="text-gray-300 mb-4 bg-gray-900 p-3 rounded"><strong>Log:</strong> O autor {c.author_name} alterou o conteúdo de {c.country_id}.</p>
                
                <div className="bg-gray-900 p-4 rounded text-sm mb-4">
                  <h4 className="text-gray-400 mb-2 uppercase text-xs tracking-widest">Diferenças Registadas</h4>
                  
                  {/* Visualização de diff simplificada */}
                  {c.diff.desc && (
                    <div className="mb-4">
                      <strong>Texto Descritivo alterado.</strong>
                    </div>
                  )}
                  {c.diff.images && c.diff.images.length > 0 && (
                    <div>
                      <strong>Imagens Canva detetadas:</strong>
                      <ul className="list-disc pl-5 mt-2 text-gray-400">
                        {c.diff.images.map((img: any, idx: number) => (
                          <li key={idx}>Posição: ({img.x}px, {img.y}px) | Dimensões: {img.w}x{img.h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {c.status === 'PENDING' && (
                  <div className="flex flex-col gap-4 mt-6 border-t border-gray-700 pt-4">
                    <div className="flex gap-4">
                      <button onClick={() => handleApprove(c._id)} className="bg-green-600 px-6 py-2 rounded hover:bg-green-500 font-bold transition">
                        Aprovar Alterações
                      </button>
                    </div>
                    
                    <div className="flex gap-2 items-center bg-gray-900 p-3 rounded">
                      <input 
                        type="text" 
                        placeholder="Escreva uma nota justificando a rejeição (obrigatório)" 
                        onChange={e => setRejectNote(e.target.value)}
                        className="flex-1 bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white"
                      />
                      <button onClick={() => handleReject(c._id)} className="bg-red-600 px-6 py-2 rounded hover:bg-red-500 font-bold transition">
                        Rejeitar
                      </button>
                    </div>
                  </div>
                )}
                
                {c.status === 'REJECTED' && (
                  <div className="mt-4 bg-red-900/30 border border-red-800 p-3 rounded text-red-200">
                    <strong>Motivo da Rejeição:</strong> {c.rejection_note}
                  </div>
                )}
              </div>
            ))}
            {commitsToShow.length === 0 && (
              <p className="text-gray-400">Nenhuma proposta encontrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
