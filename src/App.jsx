import React, { useState, useEffect } from 'react';
import './App.css';
import { auth, provider, db } from './firebase'; 
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
// --- NUEVO: Agregamos deleteDoc y doc para poder borrar ---
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore'; 

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'boton';
  });

  useEffect(() => {
    localStorage.setItem('activeTab', currentTab);
  }, [currentTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    try { 
      await signOut(auth); 
      localStorage.removeItem('activeTab'); 
      setCurrentTab('boton');
    } catch (error) { console.error(error); }
  };

  const handlePressButton = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, "clics"), {
        uid: user.uid,
        fecha: serverTimestamp() 
      });
    } catch (e) {
      console.error("Error al guardar: ", e);
    }
  };

  // --- VISTA: BOTÓN ---
  const BotonView = () => (
    <div className="tab-content centered-content">
      <div className="big-button-container">
        <button className="main-action-btn" onClick={handlePressButton}>Fui al baño</button>
        <p className="hint-text">¡Completa todos los minutos del día!</p>
      </div>
    </div>
  );

  // --- VISTA: ESTADÍSTICAS ---
  const EstadisticasView = () => {
    const [stats, setStats] = useState({ total: 0, promedioDia: 0, horaPico: "-", mapaFaltantes: {} });
    const [loadingStats, setLoadingStats] = useState(true);
    const [expandedHour, setExpandedHour] = useState(null);

    useEffect(() => {
      if (!user) return;
      const q = query(collection(db, "clics"), where("uid", "==", user.uid));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const docs = querySnapshot.docs.map(doc => doc.data());
        
        // Lógica de cálculo (resumida para no repetir tanto código, es la misma que tenías)
        let totalClics = docs.length;
        let conteoHoras = {}; 
        let diasUnicos = new Set();
        let mapaConquistados = {};

        docs.forEach(data => {
          if (!data.fecha) return; 
          const fechaObj = data.fecha ? data.fecha.toDate() : new Date();
          const hora = fechaObj.getHours();
          const minuto = fechaObj.getMinutes();
          diasUnicos.add(fechaObj.toDateString());
          conteoHoras[hora] = (conteoHoras[hora] || 0) + 1;
          if (!mapaConquistados[hora]) mapaConquistados[hora] = new Set();
          mapaConquistados[hora].add(minuto);
        });

        let horaMasComun = "-";
        if (Object.keys(conteoHoras).length > 0) {
             horaMasComun = Object.keys(conteoHoras).reduce((a, b) => conteoHoras[a] > conteoHoras[b] ? a : b) + ":00 hs";
        }
        let promedio = totalClics > 0 ? (totalClics / (diasUnicos.size || 1)).toFixed(1) : 0;
        let mapaFaltantesFinal = {};
        for (let h = 0; h < 24; h++) {
            let minutosDeEstaHora = [];
            const minutosHechos = mapaConquistados[h] || new Set();
            for (let m = 0; m < 60; m++) {
                if (!minutosHechos.has(m)) minutosDeEstaHora.push(m);
            }
            mapaFaltantesFinal[h] = minutosDeEstaHora;
        }

        setStats({ total: totalClics, promedioDia: promedio, horaPico: horaMasComun, mapaFaltantes: mapaFaltantesFinal });
        setLoadingStats(false);
      });
      return () => unsubscribe();
    }, [user]);

    const toggleHour = (hour) => setExpandedHour(expandedHour === hour ? null : hour);

    if (loadingStats) return <div className="loader-small">Sincronizando...</div>;

    return (
      <div className="tab-content">
        <h2 className="section-title">Tu Progreso</h2>
        <div className="stats-grid">
          <div className="stat-card"><h3>Total de meos</h3><p className="stat-number">{stats.total}</p></div>
          <div className="stat-card"><h3>Hora Favorita</h3><p className="stat-number" style={{fontSize: '1.5rem'}}>{stats.horaPico}</p></div>
          <div className="stat-card"><h3>Promedio / Día</h3><p className="stat-number">{stats.promedioDia}</p></div>
        </div>
        <h3 className="section-subtitle">Minutos Restantes</h3>
        <p className="hint-text-small">Toca una hora para ver qué te falta:</p>
        <div className="accordion-container">
          {Object.keys(stats.mapaFaltantes).map((hora) => {
            const faltantes = stats.mapaFaltantes[hora];
            const completado = faltantes.length === 0;
            return (
              <div key={hora} className={`accordion-item ${completado ? 'completed-item' : ''}`}>
                <button className={`accordion-header ${expandedHour === hora ? 'active' : ''}`} onClick={() => toggleHour(hora)}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    {completado && <span style={{color:'#4ade80'}}>✓</span>}
                    <span>{hora}:00 hs</span>
                  </div>
                  <span className={`badge ${completado ? 'badge-success' : ''}`}>{completado ? "¡COMPLETO!" : `${faltantes.length} faltan`}</span>
                </button>
                {expandedHour === hora && !completado && (
                  <div className="accordion-body">
                    <div className="minutes-grid">
                      {faltantes.map((min) => <div key={min} className="minute-chip missing">{hora}:{min < 10 ? `0${min}` : min}</div>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- NUEVO: VISTA CONFIGURACIÓN ---
  const ConfiguracionView = () => {
    const [registros, setRegistros] = useState([]);

    useEffect(() => {
      if (!user) return;
      const q = query(collection(db, "clics"), where("uid", "==", user.uid));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        // Mapeamos incluyendo el ID del documento para poder borrarlo luego
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Ordenamos por fecha descendente (lo más nuevo arriba) usando Javascript
        // para evitar crear índices complejos en Firebase por ahora.
        docs.sort((a, b) => {
           const dateA = a.fecha ? a.fecha.toDate() : new Date();
           const dateB = b.fecha ? b.fecha.toDate() : new Date();
           return dateB - dateA; 
        });

        setRegistros(docs);
      });
      return () => unsubscribe();
    }, [user]);

    // Función para borrar
    const handleDelete = async (id, fechaStr) => {
      if (window.confirm(`¿Estás seguro de borrar el registro del ${fechaStr}?`)) {
        try {
          await deleteDoc(doc(db, "clics", id));
        } catch (error) {
          console.error("Error al borrar:", error);
        }
      }
    };

    return (
      <div className="tab-content">
        <h2 className="section-title">Configuración</h2>
        <div className="config-section">
          <h3>Historial de Registros</h3>
          <p className="hint-text-small">Si te equivocaste, puedes eliminar registros aquí.</p>
          
          <div className="history-list">
            {registros.length === 0 && <p style={{textAlign:'center', color:'#64748b'}}>No hay registros.</p>}
            
            {registros.map((reg) => {
              const fechaObj = reg.fecha ? reg.fecha.toDate() : new Date();
              // Formatear fecha bonita: "Lun 12/05 - 14:30 hs"
              const fechaStr = fechaObj.toLocaleDateString() + ' - ' + fechaObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' hs';
              
              return (
                <div key={reg.id} className="history-item">
                  <div className="history-info">
                    <span className="history-date">{fechaStr}</span>
                  </div>
                  <button className="delete-btn" onClick={() => handleDelete(reg.id, fechaStr)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="divider" style={{margin: '2rem 0'}}></div>
        
        <button className="logout-btn-small" onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </div>
    );
  };

  if (loading) return <div className="app-container"><div className="loader"></div></div>;

  if (!user) {
    return (
      <div className="app-container">
        <div className="login-card">
          <h1 className="title">TODOS MIS MEOS</h1>
<p className="description">
            ¿Alguna vez te preguntaste si fuiste al baño en todos los minutos del dia? 
            <br /> {/* <--- Esto hace el salto de línea */}
            Una pagina para registrar todos los minutos en los que vas al baño
          </p>          <div className="divider"></div>
          <button className="google-btn" onClick={handleLogin}><span>Continuar con Google</span></button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-app-container">
      <main className="content-area">
        {currentTab === 'boton' && <BotonView />}
        {currentTab === 'estadisticas' && <EstadisticasView />}
        {/* --- NUEVO: Renderizar pestaña de configuración --- */}
        {currentTab === 'configuracion' && <ConfiguracionView />}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${currentTab === 'boton' ? 'active' : ''}`} onClick={() => setCurrentTab('boton')}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
          <span>Botón</span>
        </button>

        <button className={`nav-item ${currentTab === 'estadisticas' ? 'active' : ''}`} onClick={() => setCurrentTab('estadisticas')}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          <span>Estadísticas</span>
        </button>
        
        {/* --- NUEVO: Botón de navegación Configuración --- */}
        <button className={`nav-item ${currentTab === 'configuracion' ? 'active' : ''}`} onClick={() => setCurrentTab('configuracion')}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Config</span>
        </button>

      </nav>
    </div>
  );
}

export default App;