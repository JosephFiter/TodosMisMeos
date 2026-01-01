import React, { useState, useEffect } from 'react';
import './App.css';
import { auth, provider, db } from './firebase'; 
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
// Importamos onSnapshot para lectura en tiempo real
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore'; 

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estado de pestañas con memoria (LocalStorage)
  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'boton';
  });

  // Guardar pestaña al cambiar
  useEffect(() => {
    localStorage.setItem('activeTab', currentTab);
  }, [currentTab]);

  // Verificar autenticación
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
      // El onSnapshot actualizará la vista automáticamente
    } catch (e) {
      console.error("Error al guardar: ", e);
    }
  };

  // --- VISTA: BOTÓN ---
  const BotonView = () => (
    <div className="tab-content centered-content">
      <div className="big-button-container">
        <button className="main-action-btn" onClick={handlePressButton}>PULSAR</button>
        <p className="hint-text">¡Completa todos los minutos del día!</p>
      </div>
    </div>
  );

  // --- VISTA: ESTADÍSTICAS (Con lógica completa) ---
  const EstadisticasView = () => {
    const [stats, setStats] = useState({
      total: 0,
      promedioDia: 0,
      horaPico: "-",
      mapaFaltantes: {} 
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [expandedHour, setExpandedHour] = useState(null);

    useEffect(() => {
      if (!user) return;

      const q = query(collection(db, "clics"), where("uid", "==", user.uid));

      // Suscripción en tiempo real (onSnapshot)
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const docs = querySnapshot.docs.map(doc => doc.data());
        
        // --- PROCESAMIENTO DE DATOS ---
        let totalClics = docs.length;
        let conteoHoras = {}; 
        let diasUnicos = new Set();
        let mapaConquistados = {}; // Lo que YA hiciste

        docs.forEach(data => {
          if (!data.fecha) return; 
          // Truco: Si serverTimestamp aún no vuelve, usamos new Date() local
          const fechaObj = data.fecha ? data.fecha.toDate() : new Date();
          
          const hora = fechaObj.getHours();
          const minuto = fechaObj.getMinutes();
          const diaString = fechaObj.toDateString();

          diasUnicos.add(diaString);
          
          // Contar horas para la "Hora Pico"
          conteoHoras[hora] = (conteoHoras[hora] || 0) + 1;

          // Registrar minuto conquistado
          if (!mapaConquistados[hora]) {
            mapaConquistados[hora] = new Set();
          }
          mapaConquistados[hora].add(minuto);
        });

        // 1. Calcular Hora Pico
        let horaMasComun = "-";
        if (Object.keys(conteoHoras).length > 0) {
             horaMasComun = Object.keys(conteoHoras).reduce((a, b) => conteoHoras[a] > conteoHoras[b] ? a : b) + ":00 hs";
        }
        
        // 2. Calcular Promedio Diario
        let promedio = totalClics > 0 ? (totalClics / (diasUnicos.size || 1)).toFixed(1) : 0;

        // 3. Calcular Faltantes (Lógica Invertida)
        let mapaFaltantesFinal = {};
        for (let h = 0; h < 24; h++) {
            let minutosDeEstaHora = [];
            const minutosHechos = mapaConquistados[h] || new Set();
            
            // Recorremos los 60 minutos
            for (let m = 0; m < 60; m++) {
                // Si NO está hecho, lo agregamos a la lista de faltantes
                if (!minutosHechos.has(m)) {
                    minutosDeEstaHora.push(m);
                }
            }
            mapaFaltantesFinal[h] = minutosDeEstaHora;
        }

        setStats({
          total: totalClics,
          promedioDia: promedio,
          horaPico: horaMasComun,
          mapaFaltantes: mapaFaltantesFinal
        });
        setLoadingStats(false);
      });

      // Limpiar suscripción al salir
      return () => unsubscribe();

    }, [user]);

    const toggleHour = (hour) => {
      setExpandedHour(expandedHour === hour ? null : hour);
    };

    if (loadingStats) return <div className="loader-small">Sincronizando...</div>;

    return (
      <div className="tab-content">
        <h2 className="section-title">Tu Progreso</h2>
        
        {/* GRID DE ESTADÍSTICAS */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Clics</h3>
            <p className="stat-number">{stats.total}</p>
          </div>
          <div className="stat-card">
            <h3>Hora Favorita</h3>
            <p className="stat-number" style={{fontSize: '1.5rem'}}>{stats.horaPico}</p>
          </div>
          <div className="stat-card">
             <h3>Promedio / Día</h3>
             <p className="stat-number">{stats.promedioDia}</p>
          </div>
        </div>

        {/* LISTA DE MINUTOS RESTANTES */}
        <h3 className="section-subtitle">Minutos Restantes</h3>
        <p className="hint-text-small">Toca una hora para ver qué te falta:</p>
        
        <div className="accordion-container">
          {Object.keys(stats.mapaFaltantes).map((hora) => {
            const faltantes = stats.mapaFaltantes[hora];
            const completado = faltantes.length === 0;

            return (
              <div key={hora} className={`accordion-item ${completado ? 'completed-item' : ''}`}>
                <button 
                  className={`accordion-header ${expandedHour === hora ? 'active' : ''}`} 
                  onClick={() => toggleHour(hora)}
                >
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    {completado && <span style={{color:'#4ade80'}}>✓</span>}
                    <span>{hora}:00 hs</span>
                  </div>
                  <span className={`badge ${completado ? 'badge-success' : ''}`}>
                    {completado ? "¡COMPLETO!" : `${faltantes.length} faltan`}
                  </span>
                </button>
                
                {expandedHour === hora && !completado && (
                  <div className="accordion-body">
                    <div className="minutes-grid">
                      {faltantes.map((min) => (
                        <div key={min} className="minute-chip missing">
                          {hora}:{min < 10 ? `0${min}` : min}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="logout-btn-small" onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </div>
    );
  };

  // --- RENDERIZADO PRINCIPAL ---
  
  if (loading) return <div className="app-container"><div className="loader"></div></div>;

  if (!user) {
    return (
      <div className="app-container">
        <div className="login-card">
          <h1 className="title">DevSpace</h1>
          <p className="description">Inicia sesión para jugar.</p>
          <div className="divider"></div>
          <button className="google-btn" onClick={handleLogin}>
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-app-container">
      <main className="content-area">
        {currentTab === 'boton' && <BotonView />}
        {currentTab === 'estadisticas' && <EstadisticasView />}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${currentTab === 'boton' ? 'active' : ''}`} 
          onClick={() => setCurrentTab('boton')}
        >
          {/* Icono Círculo */}
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
          </svg>
          <span>Botón</span>
        </button>

        <button 
          className={`nav-item ${currentTab === 'estadisticas' ? 'active' : ''}`} 
          onClick={() => setCurrentTab('estadisticas')}
        >
          {/* Icono Gráfico */}
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Estadísticas</span>
        </button>
      </nav>
    </div>
  );
}

export default App;