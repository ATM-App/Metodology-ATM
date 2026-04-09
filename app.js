// ==========================================
// 1. INICIALIZACIÓN DE FIREBASE (NUBE)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCZtXbKIUh1uBk8N3ULDCewyU7KdmYnXTA",
    authDomain: "adn-keeper-methodology.firebaseapp.com",
    databaseURL: "https://adn-keeper-methodology-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "adn-keeper-methodology",
    storageBucket: "adn-keeper-methodology.firebasestorage.app",
    messagingSenderId: "808217370458",
    appId: "1:808217370458:web:11c27ae4fb71e30b6f1d63"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ==========================================
// 2. SISTEMA DE LOGIN Y ROLES HÍBRIDO
// ==========================================
const DEFAULT_USERS = {
    "admin": { pass: "1234", role: "admin", name: "Director Metodología", initials: "DM" }
};

let SYSTEM_USERS = JSON.parse(localStorage.getItem('atleti_system_users')) || DEFAULT_USERS;

database.ref('system_users').on('value', (snapshot) => {
    if(snapshot.val()) {
        SYSTEM_USERS = snapshot.val();
        localStorage.setItem('atleti_system_users', JSON.stringify(SYSTEM_USERS));
        let viewAdmin = document.getElementById('view-admin');
        if(viewAdmin && viewAdmin.classList.contains('active')) renderAdminPanel();
    }
});

function saveSystemUsers() { 
    localStorage.setItem('atleti_system_users', JSON.stringify(SYSTEM_USERS)); 
    database.ref('system_users').set(SYSTEM_USERS); 
}

let currentUser = null; let perfilActual = 'general'; let currentDBKey = 'general'; let currentDBListener = null;
let appDB = {}; 

// Funciones globales para evitar errores de referencia
window.sanitizeDB = function(db) {
    if(!db) db = {};
    if(!db.fechas) db.fechas = {};
    if(!db.statsBloques) db.statsBloques = { tecnica_defensiva:0, tecnica_ofensiva:0, tactica_defensiva:0, tactica_ofensiva:0 };
    if(!db.statsGestos) db.statsGestos = {};
    if(!db.objetivoCiclo) db.objetivoCiclo = "equilibrio";
    return db;
};

window.cargarBaseDeDatos = function(dbKey, perfil) { 
    let rawData = JSON.parse(localStorage.getItem(`atleti_metodologia_team_v1_${dbKey}_${perfil}`));
    return window.sanitizeDB(rawData); 
};

window.guardarBaseDeDatos = function() { 
    appDB = window.sanitizeDB(appDB); 
    localStorage.setItem(`atleti_metodologia_team_v1_${currentDBKey}_${perfilActual}`, JSON.stringify(appDB)); 
    database.ref(`planificaciones_team/${currentDBKey}/${perfilActual}`).set(appDB); 
};

window.conectarBaseDeDatos = function(dbKey, perfil) {
    currentDBKey = dbKey;
    perfilActual = perfil;
    
    appDB = window.cargarBaseDeDatos(currentDBKey, perfilActual);
    document.getElementById('select-objetivo').value = appDB.objetivoCiclo;
    
    if(window.generarCalendario) window.generarCalendario(document.getElementById('select-ciclo').value);
    
    if(currentDBListener) database.ref(currentDBListener).off(); 
    
    currentDBListener = `planificaciones_team/${currentDBKey}/${perfilActual}`;
    
    database.ref(currentDBListener).on('value', (snapshot) => {
        const cloudData = snapshot.val();
        if(cloudData) {
            appDB = window.sanitizeDB(cloudData);
            localStorage.setItem(`atleti_metodologia_team_v1_${currentDBKey}_${perfilActual}`, JSON.stringify(appDB));
            
            if(document.getElementById('select-objetivo').value !== appDB.objetivoCiclo) document.getElementById('select-objetivo').value = appDB.objetivoCiclo;
            if(document.getElementById('view-calendario').classList.contains('active') && window.pintarDatosGuardados) window.pintarDatosGuardados();
            if(document.getElementById('view-dashboard').classList.contains('active')) renderizarGraficos();
        }
    });
};

document.getElementById('btn-login').addEventListener('click', () => {
    let u = document.getElementById('login-user').value.trim().toLowerCase(); let p = document.getElementById('login-pass').value.trim(); let err = document.getElementById('login-error');
    if (SYSTEM_USERS[u] && SYSTEM_USERS[u].pass === p) { currentUser = SYSTEM_USERS[u]; currentUser.id = u; iniciarAplicacion(); } else { err.innerText = "❌ Usuario o contraseña incorrectos."; err.style.display = "block"; }
});

document.getElementById('login-pass').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-login').click(); });
document.getElementById('login-user').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-login').click(); });
document.getElementById('btn-logout').addEventListener('click', () => { window.location.href = window.location.href.split('#')[0]; });

function iniciarAplicacion() {
    document.getElementById('login-container').style.display = 'none'; document.getElementById('app-container').style.display = 'grid';
    document.getElementById('nav-user-name').innerText = currentUser.name; document.getElementById('nav-user-role').innerText = currentUser.role === 'admin' ? "Administrador" : "Entrenador"; 
    
    let navAvatar = document.getElementById('nav-avatar');
    if(currentUser.photo) { navAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`; } 
    else { navAvatar.innerText = currentUser.initials; }

    if (currentUser.role === 'admin') {
        document.getElementById('btn-nav-admin').classList.remove('hidden');
        document.querySelectorAll('.nav-footer:not(:last-child)').forEach(el => el.style.display = 'none');
        document.getElementById('btn-nav-cal').classList.add('hidden'); document.getElementById('btn-nav-macro').classList.add('hidden'); document.getElementById('btn-nav-dash').classList.add('hidden'); document.getElementById('btn-nav-set').classList.add('hidden');
        document.getElementById('btn-nav-admin').click(); 
        
        database.ref('planificaciones').on('value', (snapshot) => {
            const allData = snapshot.val();
            if(allData) {
                Object.keys(allData).forEach(dbK => {
                    Object.keys(allData[dbK]).forEach(perf => {
                        localStorage.setItem(`atleti_metodologia_team_v1_${dbK}_${perf}`, JSON.stringify(sanitizeDB(allData[dbK][perf])));
                    });
                });
                if(document.getElementById('view-admin').classList.contains('active')) renderAdminPanel();
            }
        });
        renderAdminPanel();
    } else {
        document.getElementById('inspector-banner').classList.add('hidden');
        let catSelect = document.getElementById('select-categoria'); let userCat = currentUser.cat ? currentUser.cat.toLowerCase() : 'formacion';
        if(userCat === "rendimiento") catSelect.value = "rendimiento"; else if(userCat === "desarrollo") catSelect.value = "desarrollo"; else catSelect.value = "formacion";
        catSelect.disabled = true; if(catSelect.dataset.customized) catSelect.dispatchEvent(new Event('change'));
        
        window.conectarBaseDeDatos(currentUser.dbKey, perfilActual); 
        document.getElementById('btn-nav-cal').click(); 
    }
}

function comprimirImagen(file, callback) {
    let reader = new FileReader();
    reader.onload = function(e) {
        let img = new Image();
        img.onload = function() {
            let canvas = document.createElement('canvas'); let ctx = canvas.getContext('2d');
            let MAX_WIDTH = 150; let MAX_HEIGHT = 150; let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7)); 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==========================================
// PANEL DE ADMINISTRADOR Y MÉTRICAS
// ==========================================
let adminGlobalChartInstance = null;

document.getElementById('btn-save-new-trainer').addEventListener('click', () => {
    let uId = document.getElementById('new-user-id').value.trim().toLowerCase(); let uPass = document.getElementById('new-user-pass').value.trim(); let uName = document.getElementById('new-user-name').value.trim(); let uRole = document.getElementById('new-user-role').value; let uCat = document.getElementById('new-user-cat').value; let uTeam = document.getElementById('new-user-team').value.trim(); let uSede = document.getElementById('new-user-sede').value.trim(); let fileInput = document.getElementById('new-user-photo');
    if(!uId || !uPass || !uName) return alert("Rellena al menos Usuario, Contraseña y Nombre");
    if(SYSTEM_USERS.hasOwnProperty(uId)) return alert("Ese usuario de acceso ya existe. Elige otro.");
    let initials = uName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase(); let newDbKey = 'trainer_' + new Date().getTime();
    
    const guardarEntrenador = (photoData) => {
        try {
            SYSTEM_USERS[uId] = { pass: uPass, role: uRole, name: uName, cat: uCat, team: uTeam, sede: uSede, dbKey: newDbKey, initials: initials, photo: photoData };
            saveSystemUsers(); document.getElementById('create-trainer-modal').classList.add('hidden'); renderAdminPanel(); 
            document.getElementById('new-user-id').value = ''; document.getElementById('new-user-pass').value = ''; document.getElementById('new-user-name').value = ''; document.getElementById('new-user-team').value = ''; document.getElementById('new-user-sede').value = ''; document.getElementById('new-user-photo').value = '';
            mostrarAlerta("✅ Creado", `Perfil ${uName} registrado.`, false);
        } catch (error) { alert("Error: Imagen demasiado pesada o espacio insuficiente."); }
    };
    if (fileInput.files && fileInput.files[0]) { comprimirImagen(fileInput.files[0], function(fotoComprimida) { guardarEntrenador(fotoComprimida); }); } else { guardarEntrenador(null); }
});

document.getElementById('btn-update-trainer').addEventListener('click', () => {
    let originalId = document.getElementById('edit-user-original-id').value; let newId = document.getElementById('edit-user-id').value.trim().toLowerCase();
    if(!newId) return alert("El usuario no puede estar vacío.");
    if (newId !== originalId && SYSTEM_USERS.hasOwnProperty(newId)) return alert("El nuevo usuario de acceso ya existe. Elige otro.");
    let user = SYSTEM_USERS[originalId];
    user.pass = document.getElementById('edit-user-pass').value.trim(); user.name = document.getElementById('edit-user-name').value.trim(); user.role = document.getElementById('edit-user-role').value; user.cat = document.getElementById('edit-user-cat').value; user.team = document.getElementById('edit-user-team').value.trim(); user.sede = document.getElementById('edit-user-sede').value.trim(); user.initials = user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase(); let fileInput = document.getElementById('edit-user-photo');
    
    const finalizeUpdate = () => {
        if (newId !== originalId) { SYSTEM_USERS[newId] = user; delete SYSTEM_USERS[originalId]; if (currentUser.id === originalId) currentUser.id = newId; }
        saveSystemUsers(); document.getElementById('edit-trainer-modal').classList.add('hidden');
        if (currentUser.id === newId) { document.getElementById('nav-user-name').innerText = user.name; let navAvatar = document.getElementById('nav-avatar'); if(user.photo) { navAvatar.innerHTML = `<img src="${user.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`; } else { navAvatar.innerText = user.initials; } }
        renderAdminPanel(); mostrarAlerta("✅ Actualizado", `Datos guardados.`, false);
    };
    if (fileInput.files && fileInput.files[0]) { comprimirImagen(fileInput.files[0], function(fotoComprimida) { user.photo = fotoComprimida; finalizeUpdate(); }); } else { finalizeUpdate(); }
});

window.borrarEntrenador = function(uId, name) {
    if(uId === currentUser.id) return alert("No puedes eliminar tu propia cuenta mientras estás dentro.");
    if(confirm(`¿Estás seguro de eliminar a ${name}?\nSe perderá su acceso.`)) { delete SYSTEM_USERS[uId]; saveSystemUsers(); renderAdminPanel(); mostrarAlerta("🗑️ Eliminado", `El perfil ha sido borrado.`, false); }
};

window.abrirEditarEntrenador = function(uId) {
    let user = SYSTEM_USERS[uId]; document.getElementById('edit-user-original-id').value = uId; document.getElementById('edit-user-id').value = uId; document.getElementById('edit-user-pass').value = user.pass; document.getElementById('edit-user-name').value = user.name; document.getElementById('edit-user-role').value = user.role; document.getElementById('edit-user-cat').value = user.cat ? user.cat.toLowerCase() : 'formacion'; document.getElementById('edit-user-team').value = user.team || ''; document.getElementById('edit-user-sede').value = user.sede || ''; document.getElementById('edit-user-photo').value = '';
    let roleSelect = document.getElementById('edit-user-role'); if(roleSelect.dataset.customized) roleSelect.dispatchEvent(new Event('change'));
    let catSelect = document.getElementById('edit-user-cat'); if(catSelect.dataset.customized) catSelect.dispatchEvent(new Event('change'));
    document.getElementById('edit-trainer-modal').classList.remove('hidden');
};

function renderAdminPanel() {
    const grid = document.getElementById('admin-trainers-grid'); grid.innerHTML = '';
    let globalSesiones = 0; let globalSemanas = new Set(); let globalCarga = 0; let globalNat = { a:0, sa:0, g:0, jr:0 }; let entrenadoresTotales = 0;
    
    Object.entries(SYSTEM_USERS).forEach(([uId, user]) => {
        let numSesionesTrainer = 0; let semanasTrainer = new Set();

        if(user.role === 'trainer') {
            entrenadoresTotales++; 
            let dbRaw = JSON.parse(localStorage.getItem(`atleti_metodologia_team_v1_${user.dbKey}_general`));
            let dbTrainer = window.sanitizeDB(dbRaw);
            
            Object.entries(dbTrainer.fechas).forEach(([fechaIso, d]) => { 
                let isMatch = d.evento === 'partido';
                if(d.tareas && d.tareas.length > 0 && !isMatch) { 
                    numSesionesTrainer++; globalSesiones++;
                    let dateObj = new Date(fechaIso + "T12:00:00"); 
                    let msLunes = getMonday(dateObj).getTime();
                    semanasTrainer.add(msLunes); globalSemanas.add(msLunes);

                    d.tareas.forEach(t => { 
                        if(t.carga) globalCarga += t.carga; 
                        if(t.naturaleza === 'analitica') globalNat.a++; if(t.naturaleza === 'semi_analitica') globalNat.sa++; 
                        if(t.naturaleza === 'global') globalNat.g++; if(t.naturaleza === 'juego_real') globalNat.jr++; 
                    }); 
                } 
            });
        }
        
        let numMicrociclosTrainer = semanasTrainer.size;
        let catStr = user.role === 'admin' ? "👑 ADMINISTRADOR" : (user.cat === 'rendimiento' ? "Rendimiento" : (user.cat === 'desarrollo' ? "Desarrollo" : "Formación"));
        let avatarHtml = user.photo ? `<img src="${user.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : user.initials;
        
        let auditarBtn = user.role === 'trainer' ? `<button class="btn-primary" style="flex: 3; background: var(--atleti-blue); font-size:0.8rem; padding:10px;" onclick="auditarEntrenador('${user.dbKey}', '${user.name}')">👁️ Auditar</button>` : ``;
        let flexEdit = user.role === 'trainer' ? '2' : '4';
        let actionsHtml = `<div style="display: flex; gap: 8px; margin-top: 10px;">${auditarBtn}<button class="btn-primary" style="flex: ${flexEdit}; background: #FF9800; font-size:0.8rem; padding:10px;" onclick="abrirEditarEntrenador('${uId}')">✏️ Editar</button><button class="btn-danger" style="flex: 1; padding:10px; font-size:0.9rem;" onclick="borrarEntrenador('${uId}', '${user.name}')">🗑️</button></div>`;

        let statsInfo = user.role === 'admin' 
            ? `<span>🛡️ <b>Control Total del Sistema</b></span>` 
            : `<span>🛡️ <b>Equipo:</b> ${user.team}</span><span>📍 <b>Sede:</b> ${user.sede}</span><span style="color:var(--atleti-blue); font-weight:bold; margin-top:8px; display:block;">📊 Sesiones: ${numSesionesTrainer}</span><span style="color:var(--atleti-red); font-weight:bold; display:block;">📅 Microciclos: ${numMicrociclosTrainer}</span>`;

        grid.innerHTML += `<div class="trainer-card"><div class="trainer-card-header"><div class="trainer-avatar">${avatarHtml}</div><div class="trainer-info"><h3>${user.name}</h3><p style="color:${user.role==='admin'?'var(--atleti-red)':'#666'}">${catStr}</p></div></div><div class="trainer-details">${statsInfo}</div>${actionsHtml}</div>`;
    });

    let globalMicrociclos = globalSemanas.size;

    if(adminGlobalChartInstance) adminGlobalChartInstance.destroy(); const ctxGlobal = document.getElementById('adminGlobalChart').getContext('2d');
    adminGlobalChartInstance = new Chart(ctxGlobal, { type: 'doughnut', data: { labels: ['Analítica', 'Semi-Analítica', 'Global', 'Juego Real'], datasets: [{ data: [globalNat.a, globalNat.sa, globalNat.g, globalNat.jr], backgroundColor: ['#9E9E9E', '#FF9800', '#2196f3', '#F44336'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, title: {display: true, text: 'Distribución de Especificidad de toda la Cantera'} } } });
    
    document.getElementById('admin-kpis').innerHTML = `<li>👥 <b>Entrenadores Activos:</b> ${entrenadoresTotales}</li><li>📊 <b>Sesiones Globales:</b> ${globalSesiones}</li><li>📅 <b>Microciclos Globales:</b> ${globalMicrociclos}</li><li>🔋 <b>Carga Total:</b> ${globalCarga} UA</li><li>🔬 <b>Tendencia Academia:</b> ${globalNat.jr > globalNat.sa ? '<span style="color:#4CAF50">Alta (Juego Real)</span>' : '<span style="color:#FF9800">Media (Semi-Analítica)</span>'}</li>`;
}

window.auditarEntrenador = function(dbKey, trainerName) {
    document.getElementById('inspector-banner').classList.remove('hidden'); document.getElementById('inspector-name').innerText = trainerName;
    document.getElementById('btn-nav-cal').classList.remove('hidden'); document.getElementById('btn-nav-macro').classList.remove('hidden'); document.getElementById('btn-nav-dash').classList.remove('hidden'); document.getElementById('nav-profile-selector').style.display = 'block';
    
    let auditedUser = Object.values(SYSTEM_USERS).find(u => u.dbKey === dbKey);
    if(auditedUser) {
        let catSelect = document.getElementById('select-categoria');
        let userCat = auditedUser.cat ? auditedUser.cat.toLowerCase() : 'formacion';
        if(userCat === "rendimiento") catSelect.value = "rendimiento"; else if(userCat === "desarrollo") catSelect.value = "desarrollo"; else catSelect.value = "formacion";
        catSelect.disabled = true; if(catSelect.dataset.customized) catSelect.dispatchEvent(new Event('change'));
    }
    
    window.conectarBaseDeDatos(dbKey, perfilActual);
    document.getElementById('btn-nav-cal').click(); 
};

window.volverPanelAdmin = function() {
    document.getElementById('inspector-banner').classList.add('hidden'); document.getElementById('btn-nav-cal').classList.add('hidden'); document.getElementById('btn-nav-macro').classList.add('hidden'); document.getElementById('btn-nav-dash').classList.add('hidden'); document.getElementById('nav-profile-selector').style.display = 'none';
    let catSelect = document.getElementById('select-categoria'); catSelect.disabled = false; if(catSelect.dataset.customized) catSelect.dispatchEvent(new Event('change'));
    
    if(currentDBListener) database.ref(currentDBListener).off(); 
    
    document.getElementById('btn-nav-admin').click(); renderAdminPanel(); 
};

// ==========================================
// 3. BASE DE DATOS METODOLÓGICA (CONEXIÓN NUBE Y SANITIZACIÓN)
// ==========================================
const metodologiaPorDefecto = {
    tecnica_defensiva: { 
        "Recuperación": ["Entrada frontal", "Entrada lateral (Tackle)", "Interceptación", "Carga", "Anticipación", "Despeje orientado"], 
        "Fundamentos Individuales": ["Perfil corporal defensivo", "Técnica de contención (Temporización)", "Acoso y presión individual", "Marcaje al hombre", "Marcaje zonal"] 
    },
    tecnica_ofensiva: { 
        "Pase": ["Pase corto (Interior)", "Pase medio (Tenso)", "Pase largo (Empeine)", "Pase filtrado", "Cambio de orientación"], 
        "Control": ["Control clásico", "Control orientado", "Amortiguamiento (Pecho/Muslo)"], 
        "Progresión": ["Conducción de seguridad", "Conducción para fijar", "Regate en 1vs1 (Desborde)", "Protección del balón"], 
        "Finalización": ["Tiro de precisión (Interior)", "Tiro de potencia (Empeine)", "Remate de cabeza", "Volea / Semivolea", "Centro lateral"] 
    },
    tactica_defensiva: { 
        "Estructura Defensiva": ["Bloque Bajo", "Bloque Medio", "Bloque Alto (Presión)"], 
        "Principios Zonales": ["Basculación de línea", "Cobertura mutua", "Permuta", "Achique de espacios (Tirar la línea)", "Cierre de pasillos interiores"], 
        "Transición Defensiva": ["Presión tras pérdida (Inmediata)", "Repliegue intensivo", "Faltas tácticas", "Vigilancia ofensiva"], 
        "ABP Defensivo": ["Defensa de Córner (Zonal/Mixta)", "Defensa de Faltas Laterales", "Defensa de Faltas Frontales", "Barreras"] 
    },
    tactica_ofensiva: { 
        "Salida de Balón": ["Salida desde portería (Corto)", "Salida con pivote incrustado", "Salida directa (Juego en largo)", "Atracción de presión"], 
        "Ataque Organizado": ["Juego interior (Pasillos centrales)", "Amplitud (Juego exterior)", "Profundidad (Rupturas a la espalda)", "Tercer hombre", "Fijar y dividir", "Superioridad numérica"], 
        "Transición Ofensiva": ["Contraataque directo", "Ataque rápido (Despliegue)"], 
        "Movimientos sin balón": ["Desmarque de apoyo", "Desmarque de ruptura", "Aclarados y arrastres", "Desdoblamientos"], 
        "ABP Ofensivo": ["Córners ofensivos", "Faltas Laterales al área", "Faltas Directas", "Jugadas de estrategia"] 
    }
};

let metodologia = JSON.parse(localStorage.getItem('atleti_diccionario_team_v1')) || JSON.parse(JSON.stringify(metodologiaPorDefecto));

database.ref('diccionario_metodologia_team').on('value', (snapshot) => {
    if(snapshot.val()) { metodologia = snapshot.val(); localStorage.setItem('atleti_diccionario_team_v1', JSON.stringify(metodologia)); if(document.getElementById('view-settings').classList.contains('active')) renderSettingsUI(); }
});

function guardarDiccionario() { 
    localStorage.setItem('atleti_diccionario_team_v1', JSON.stringify(metodologia)); 
    database.ref('diccionario_metodologia_team').set(metodologia); 
}
window.resetMetodologia = function() { if(confirm("¿Restaurar los conceptos por defecto? Perderás los personalizados.")) { metodologia = JSON.parse(JSON.stringify(metodologiaPorDefecto)); guardarDiccionario(); location.reload(); } }

const alternativasInteligentes = { 
    "Bloque Alto (Presión)": { msg: "Alta fatiga detectada. Considera reducir la altura de la presión.", opciones: ["Bloque Medio", "Presión tras pérdida (Inmediata)"] }, 
    "Pase largo (Empeine)": { msg: "Excesiva carga de golpeo largo. Cambia la distancia.", opciones: ["Pase corto (Interior)", "Pase filtrado"] }, 
    "Contraataque directo": { msg: "Demasiadas transiciones de alta intensidad en velocidad. Sugerimos ataque posicional.", opciones: ["Ataque Organizado", "Juego interior (Pasillos centrales)"] }, 
    "Repliegue intensivo": { msg: "Exceso de metros recorridos hacia atrás. Propón recuperación adelantada.", opciones: ["Presión tras pérdida (Inmediata)", "Bloque Medio"] }, 
    "Córners ofensivos": { msg: "Saturación en ABP desde las esquinas. Cambia a faltas o estrategia lateral.", opciones: ["Faltas Laterales al área", "Jugadas de estrategia"] } 
};

function analizarGesto(gesto, bloque) {
    let cog = 2, ten = 2; let cadenas = [];
    const mapEncadenamientos = { 
        "Pase corto": ["Desmarque de apoyo", "Tercer hombre", "Pase filtrado"],
        "Pase largo": ["Control orientado", "Amortiguamiento", "Amplitud (Juego exterior)"],
        "Control orientado": ["Pase filtrado", "Conducción para fijar", "Tiro de precisión (Interior)"],
        "Regate en 1vs1": ["Centro lateral", "Tiro de potencia (Empeine)", "Pase atrás"],
        "Entrada frontal": ["Transición Ofensiva", "Pase de seguridad"],
        "Anticipación": ["Ataque rápido (Despliegue)", "Pase corto (Interior)"],
        "Bloque Bajo": ["Transición Ofensiva", "Contraataque directo", "Repliegue intensivo"],
        "Bloque Alto": ["Recuperación", "Finalización", "Tiro de precisión (Interior)"],
        "Presión tras pérdida": ["Ataque Organizado", "Juego interior (Pasillos centrales)"],
        "Salida de Balón": ["Tercer hombre", "Juego interior", "Amplitud"],
        "Ataque Organizado": ["Profundidad (Rupturas a la espalda)", "Centro lateral", "Fijar y dividir"],
        "Centro lateral": ["Remate de cabeza", "Volea / Semivolea", "Defensa de 2as jugadas"],
        "Desmarque de ruptura": ["Pase filtrado", "Pase largo (Empeine)"],
        "Basculación": ["Cobertura mutua", "Cierre de pasillos interiores"]
    };
    for (const key in mapEncadenamientos) { if (gesto.includes(key)) { cadenas = mapEncadenamientos[key]; break; } }
    if (cadenas.length === 0) cadenas = ["Reorganización táctica", "Continuidad en el juego"];
    
    if(gesto.includes("1vs1") || gesto.includes("Transición") || gesto.includes("Tiro") || gesto.includes("Remate") || gesto.includes("Presión") || gesto.includes("Bloque Alto") || gesto.includes("Contraataque") || gesto.includes("Ruptura") || gesto.includes("Tackle")) { cog = 3; ten = 3; } 
    else if(bloque.includes("tactica")) { cog = 3; ten = 2; } 
    else if(gesto.includes("Control") || gesto.includes("Pase corto") || gesto.includes("Perfil corporal") || gesto.includes("Zonal")) { cog = 1; ten = 1; }
    return { cargaCog: cog, cargaTen: ten, sugerencias: cadenas };
}

function toLocalISO(dateObj) { const d = new Date(dateObj); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function getMonday(d) { d = new Date(d); let day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }

const nombresMesesPdf = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatWeekTitle(lunes) { let domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6); return `Semana del ${lunes.getDate()} de ${nombresMesesPdf[lunes.getMonth()].substring(0,3).toLowerCase()} al ${domingo.getDate()} de ${nombresMesesPdf[domingo.getMonth()].substring(0,3).toLowerCase()}`; }
function getPrimerLunesMeso(d) { let firstDay = new Date(d.getFullYear(), d.getMonth(), 1); let day = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); if (day > 4) { firstDay.setDate(firstDay.getDate() + (8 - day)); } else { firstDay.setDate(firstDay.getDate() - (day - 1)); } return firstDay; }
function getUltimoLunesMeso(d) { let lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0); let day = lastDay.getDay() === 0 ? 7 : lastDay.getDay(); if (day < 4) { lastDay.setDate(lastDay.getDate() - day - 6); } else { lastDay.setDate(lastDay.getDate() - (day - 1)); } return lastDay; }

let diaYsemanaActual = ""; let adnChartInstance = null; let balanceChartInstance = null; let realizadoChartInstance = null; let cargaChartInstance = null; let compareRadarChartInstance = null; let matrizChartInstance = null;

// LÓGICA VISTA AJUSTES
let setBloqueActual = "tecnica_defensiva"; let setConceptoActual = null;
function renderSettingsUI() {
    const listConceptos = document.getElementById('set-concept-list'); const listGestos = document.getElementById('set-gesto-list'); const tituloConcepto = document.getElementById('set-concepto-title'); const formGestos = document.getElementById('set-gesto-controls');
    listConceptos.innerHTML = ''; listGestos.innerHTML = '';
    if(!metodologia[setBloqueActual]) metodologia[setBloqueActual] = {};
    Object.keys(metodologia[setBloqueActual]).forEach(concepto => {
        let li = document.createElement('li'); li.innerHTML = `<span>📁 ${concepto}</span> <button class="btn-delete-small" onclick="borrarConcepto(event, '${concepto}')">🗑️</button>`;
        if(setConceptoActual === concepto) li.classList.add('active'); li.onclick = () => { setConceptoActual = concepto; renderSettingsUI(); }; listConceptos.appendChild(li);
    });
    if(setConceptoActual && metodologia[setBloqueActual][setConceptoActual]) {
        tituloConcepto.innerHTML = `Gestos dentro de: <b>${setConceptoActual}</b>`; formGestos.classList.remove('hidden');
        metodologia[setBloqueActual][setConceptoActual].forEach((gesto, index) => { let li = document.createElement('li'); li.innerHTML = `<span>${gesto}</span> <button class="btn-delete-small" onclick="borrarGesto(${index})">✖</button>`; listGestos.appendChild(li); });
    } else { tituloConcepto.innerHTML = `Selecciona un concepto en la columna izquierda`; formGestos.classList.add('hidden'); }
}
document.getElementById('set-select-bloque').addEventListener('change', (e) => { setBloqueActual = e.target.value; setConceptoActual = null; renderSettingsUI(); });
document.getElementById('set-btn-add-concepto').addEventListener('click', () => { let val = document.getElementById('set-input-concepto').value.trim(); if(val && !metodologia[setBloqueActual][val]) { metodologia[setBloqueActual][val] = []; guardarDiccionario(); document.getElementById('set-input-concepto').value = ""; renderSettingsUI(); } });
document.getElementById('set-btn-add-gesto').addEventListener('click', () => { let val = document.getElementById('set-input-gesto').value.trim(); if(val && setConceptoActual) { metodologia[setBloqueActual][setConceptoActual].push(val); guardarDiccionario(); document.getElementById('set-input-gesto').value = ""; renderSettingsUI(); } });
window.borrarConcepto = function(e, concepto) { e.stopPropagation(); if(confirm(`¿Borrar el concepto "${concepto}" y sus gestos?`)) { delete metodologia[setBloqueActual][concepto]; if(setConceptoActual === concepto) setConceptoActual = null; guardarDiccionario(); renderSettingsUI(); } };
window.borrarGesto = function(index) { metodologia[setBloqueActual][setConceptoActual].splice(index, 1); guardarDiccionario(); renderSettingsUI(); };

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('select-perfil').addEventListener('change', (e) => {
        window.conectarBaseDeDatos(currentDBKey, e.target.value); 
        mostrarAlerta("👤 Perfil Cambiado", `Ahora editando planificación de: ${e.target.options[e.target.selectedIndex].text}`, false);
    });

    const navBtns = document.querySelectorAll('.nav-btn'); const views = document.querySelectorAll('.view-section');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            views.forEach(v => { if (v.id === targetId) { v.classList.remove('hidden'); v.classList.add('active'); } else { v.classList.add('hidden'); v.classList.remove('active'); } });
            if(targetId === 'view-dashboard') { renderizarGraficos(); poblarSelectoresComparativa(); }
            if(targetId === 'view-settings') renderSettingsUI(); 
            if(targetId === 'view-macro') renderMacrociclo();
        });
    });

    document.getElementById('select-objetivo').addEventListener('change', (e) => { appDB.objetivoCiclo = e.target.value; window.guardarBaseDeDatos(); });
    const selectCiclo = document.getElementById('select-ciclo'); const calendarioContainer = document.getElementById('calendario-container');
    
    window.generarCalendario = function(tipoCiclo) {
        calendarioContainer.innerHTML = ''; const hoy = new Date(); hoy.setHours(0, 0, 0, 0); let fechaInicioIteracion, numSemanas = 0;
        if (tipoCiclo === 'micro') { fechaInicioIteracion = getMonday(hoy); numSemanas = 1; } 
        else if (tipoCiclo === 'meso') { let primerLunes = getPrimerLunesMeso(hoy); let ultimoLunes = getUltimoLunesMeso(hoy); fechaInicioIteracion = new Date(primerLunes); numSemanas = Math.round((ultimoLunes - primerLunes) / (7 * 24 * 60 * 60 * 1000)) + 1; } 
        else if (tipoCiclo === 'macro') { let startYear = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1; let dAgosto = new Date(startYear, 7, 1); fechaInicioIteracion = getPrimerLunesMeso(dAgosto); let dJunio = new Date(startYear + 1, 5, 30); let ultimoLunes = getUltimoLunesMeso(dJunio); numSemanas = Math.round((ultimoLunes - fechaInicioIteracion) / (7 * 24 * 60 * 60 * 1000)) + 1; }

        let lunesActual = getMonday(hoy).getTime();
        for (let s = 0; s < numSemanas; s++) {
            let fechaSemana = new Date(fechaInicioIteracion); fechaSemana.setDate(fechaSemana.getDate() + (s * 7)); let isoLunes = toLocalISO(fechaSemana); let isSemanaActual = (fechaSemana.getTime() === lunesActual); 
            let controlesSemana = (currentUser && currentUser.role === 'trainer') ? `<div style="display:flex; gap:5px; flex-wrap:wrap;"><button class="btn-primary" style="padding: 6px 10px; font-size: 0.8rem; background:#ff9800;" onclick="abrirModalPlantilla('${isoLunes}')" title="Guardar como Plantilla">💾 Guardar</button><button class="btn-primary" style="padding: 6px 10px; font-size: 0.8rem; background:#2196f3;" onclick="cargarPlantillaPrompt('${isoLunes}')" title="Cargar Plantilla">📂 Cargar</button><button class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="limpiarSemana('${isoLunes}')">🗑️ Limpiar</button></div>` : ``;
            let semanaHTML = `<div class="week-container"><h2 class="week-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;"><div><span>${formatWeekTitle(fechaSemana)}</span>${isSemanaActual ? '<span class="badge-actual">Microciclo Actual</span>' : ''}</div>${controlesSemana}</h2><div class="calendar-grid">`;
            for (let d = 0; d < 7; d++) {
                let fechaDia = new Date(fechaSemana); fechaDia.setDate(fechaDia.getDate() + d); let dateStrISO = toLocalISO(fechaDia); let isHoy = (fechaDia.getTime() === hoy.getTime());
                let btnAdd = (currentUser && currentUser.role === 'trainer') ? `<button class="btn-add" onclick="abrirModal('${dateStrISO}', '${fechaDia.toLocaleDateString('es-ES', {weekday: 'long'})} ${fechaDia.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'})}')">+</button>` : ``;
                semanaHTML += `<div class="day-card ${isHoy ? 'today' : ''}" id="card-${dateStrISO}"><div class="day-header"><div class="day-info"><h3>${fechaDia.toLocaleDateString('es-ES', {weekday: 'long'})}</h3><span>${fechaDia.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'})} ${isHoy ? ' (Hoy)' : ''}</span></div>${btnAdd}</div><div class="day-context-box" id="context-${dateStrISO}"></div><div class="task-list" id="list-${dateStrISO}"></div></div>`;
            }
            semanaHTML += `</div></div>`; calendarioContainer.innerHTML += semanaHTML;
        }
        window.pintarDatosGuardados();
    };
    selectCiclo.addEventListener('change', (e) => window.generarCalendario(e.target.value));

    const selectBloque = document.getElementById('select-bloque'); const selectConcepto = document.getElementById('select-concepto');
    const selectGesto = document.getElementById('select-gesto'); const selectEncadenamiento = document.getElementById('select-encadenamiento'); const selectNaturaleza = document.getElementById('select-naturaleza'); const contenedorEncadenamiento = document.getElementById('encadenamiento-container');
    
    selectBloque.addEventListener('change', (e) => { 
        const bloque = e.target.value; selectConcepto.innerHTML = '<option value="">2. Concepto...</option>'; selectGesto.innerHTML = '<option value="">3. Gesto Específico...</option>'; selectGesto.disabled = true; contenedorEncadenamiento.classList.add('hidden'); 
        if (bloque && metodologia[bloque]) { Object.keys(metodologia[bloque]).forEach(concepto => { selectConcepto.innerHTML += `<option value="${concepto}">${concepto}</option>`; }); selectConcepto.disabled = false; } else selectConcepto.disabled = true; 
        
        if (bloque === 'tactica_ofensiva') { document.getElementById('playbook-container').classList.remove('hidden'); } else { document.getElementById('playbook-container').classList.add('hidden'); }
        
        if(selectConcepto.dataset.customized) { selectConcepto.dispatchEvent(new Event('change')); }
        if(selectGesto.dataset.customized) { selectGesto.dispatchEvent(new Event('change')); }
    });
    
    selectConcepto.addEventListener('change', (e) => { 
        const bloque = selectBloque.value; const concepto = e.target.value; selectGesto.innerHTML = '<option value="">3. Gesto Específico...</option>'; contenedorEncadenamiento.classList.add('hidden'); 
        if (concepto && metodologia[bloque][concepto]) { metodologia[bloque][concepto].forEach(gesto => { selectGesto.innerHTML += `<option value="${gesto}">${gesto}</option>`; }); selectGesto.disabled = false; } 
        else { selectGesto.disabled = true; }
        
        if(selectGesto.dataset.customized) { selectGesto.dispatchEvent(new Event('change')); }
    });

    selectGesto.addEventListener('change', (e) => { 
        const analisis = analizarGesto(e.target.value, selectBloque.value); selectEncadenamiento.innerHTML = '<option value="">Sin encadenamiento</option>'; 
        analisis.sugerencias.forEach(sug => { selectEncadenamiento.innerHTML += `<option value="${sug}">${sug}</option>`; }); 
        contenedorEncadenamiento.classList.remove('hidden'); 
        if(selectEncadenamiento.dataset.customized) { selectEncadenamiento.dispatchEvent(new Event('change')); }
    });

    document.getElementById('btn-guardar-tarea').addEventListener('click', (e) => {
        e.preventDefault();
        if(!appDB.fechas[diaYsemanaActual]) { appDB.fechas[diaYsemanaActual] = { evento: "", contexto: { condicional: "", emocional: "", transversal: "" }, tareas: [] }; }
        appDB.fechas[diaYsemanaActual].evento = document.getElementById('select-evento-especial').value;
        const gesto = selectGesto.value; const bloqueValue = selectBloque.value; const naturaleza = selectNaturaleza.value;
        let duracion = parseInt(document.getElementById('input-duracion').value) || 0; let rpe = parseInt(document.getElementById('select-rpe').value) || 5; let unidadesCarga = duracion * rpe;
        let viaSalida = (bloqueValue === 'tactica_ofensiva') ? document.getElementById('select-via-salida').value : null;

        if (gesto && bloqueValue) {
            let fechaGuardar = new Date(diaYsemanaActual + "T12:00:00"); fechaGuardar.setDate(fechaGuardar.getDate() + 1); let isoManana = toLocalISO(fechaGuardar); 
            let partidoMañana = (appDB.fechas[isoManana] && appDB.fechas[isoManana].evento === 'partido'); const analisis = analizarGesto(gesto, bloqueValue);
            // Protocolo MD-1 Adaptado a Jugadores
            if(partidoMañana && analisis.cargaTen === 3) { mostrarAlerta("🚨 ALERTA MÉDICA: PROTOCOLO MD-1", `Mañana hay partido. Prohibido introducir tareas de altísima intensidad neuromuscular o metabólica (${gesto}) hoy.`, true, true); return; }
            let repeticiones = parseInt(appDB.statsGestos[gesto]) || 0; let limite = document.getElementById('select-categoria').value === 'rendimiento' ? 4 : 8;
            if (repeticiones >= limite) { if (alternativasInteligentes[gesto]) { mostrarSmartCard(gesto, alternativasInteligentes[gesto]); } else { mostrarAlerta("⚠️ Límite", `Has repetido ${gesto} ${repeticiones} veces.`, true); } return; }

            appDB.fechas[diaYsemanaActual].tareas.push({ bloqueID: bloqueValue, bloqueTexto: selectBloque.options[selectBloque.selectedIndex].text, gesto: gesto, encadenado: selectEncadenamiento.value, cognitiva: analisis.cargaCog, status: 'planned', naturaleza: naturaleza, calidad: 0, duracion: duracion, rpe: rpe, carga: unidadesCarga, viaSalida: viaSalida });
            appDB.statsGestos[gesto] = repeticiones + 1; appDB.statsBloques[bloqueValue] = (appDB.statsBloques[bloqueValue] || 0) + 1;
            mostrarAlerta("✅ Guardado", `Tarea registrada con ${unidadesCarga} Unidades de Carga.`, false);
        } else { mostrarAlerta("✅ Guardado", `Contexto actualizado.`, false); }
        const cond = document.getElementById('input-condicional').value; const emo = document.getElementById('input-emocional').value; const trans = document.getElementById('input-transversal').value;
        appDB.fechas[diaYsemanaActual].contexto.condicional = cond || ""; appDB.fechas[diaYsemanaActual].contexto.emocional = emo || ""; appDB.fechas[diaYsemanaActual].contexto.transversal = trans || "";
        window.guardarBaseDeDatos(); window.pintarDatosGuardados(); cerrarModal(); 
    });

    document.getElementById('btn-limpiar-dia').addEventListener('click', (e) => { e.preventDefault(); if(appDB.fechas[diaYsemanaActual]) { let tareasDelDia = appDB.fechas[diaYsemanaActual].tareas || []; tareasDelDia.forEach(t => { if(t.bloqueID && appDB.statsBloques[t.bloqueID]) appDB.statsBloques[t.bloqueID] = Math.max(0, appDB.statsBloques[t.bloqueID] - 1); if(t.gesto && appDB.statsGestos[t.gesto]) appDB.statsGestos[t.gesto] = Math.max(0, appDB.statsGestos[t.gesto] - 1); }); delete appDB.fechas[diaYsemanaActual]; window.guardarBaseDeDatos(); window.pintarDatosGuardados(); mostrarAlerta("🗑️ Día Limpiado", "Planificación eliminada.", false); } cerrarModal(); });
    window.limpiarSemana = function(isoLunes) { if(confirm("¿Seguro que quieres borrar TODA la planificación de esta semana?")) { let fechaLunes = new Date(isoLunes + "T12:00:00"); for(let i=0; i<7; i++) { let fd = new Date(fechaLunes); fd.setDate(fd.getDate() + i); let iso = toLocalISO(fd); if(appDB.fechas[iso]) { let tareas = appDB.fechas[iso].tareas || []; tareas.forEach(t => { if(t.bloqueID && appDB.statsBloques[t.bloqueID]) appDB.statsBloques[t.bloqueID] = Math.max(0, appDB.statsBloques[t.bloqueID] - 1); if(t.gesto && appDB.statsGestos[t.gesto]) appDB.statsGestos[t.gesto] = Math.max(0, appDB.statsGestos[t.gesto] - 1); }); delete appDB.fechas[iso]; } } window.guardarBaseDeDatos(); window.pintarDatosGuardados(); mostrarAlerta("🗑️ Semana Limpiada", "Toda la semana eliminada.", false); } };

    function mostrarSmartCard(gestoOriginal, alternativaObj) { let botonesHTML = ''; alternativaObj.opciones.forEach(opc => { botonesHTML += `<button class="btn-alt" onclick="aplicarAlternativaAutomatica('${opc}')"><span> Sustituir por: </span> <b>${opc}</b></button>`; }); document.getElementById('smart-card-container').innerHTML = `<div class="smart-card"><div class="smart-card-header">⚠️ Alerta Metodológica</div><p>Límite superado para <b>${gestoOriginal}</b>.<br>${alternativaObj.msg}</p><div class="smart-btn-group">${botonesHTML}</div></div>`; document.getElementById('smart-card-container').classList.remove('hidden'); }
    window.aplicarAlternativaAutomatica = function(nuevoGesto) { 
        let selectGesto = document.getElementById('select-gesto');
        selectGesto.innerHTML += `<option value="${nuevoGesto}" selected>${nuevoGesto}</option>`; 
        selectGesto.value = nuevoGesto; 
        if(selectGesto.dataset.customized) { selectGesto.dispatchEvent(new Event('change')); }
        document.getElementById('smart-card-container').classList.add('hidden'); 
        document.getElementById('btn-guardar-tarea').click(); 
    };
    window.toggleTaskStatus = function(fechaISO, taskIndex, nuevoStatus) { appDB.fechas[fechaISO].tareas[taskIndex].status = nuevoStatus; if(nuevoStatus === 'done' && !appDB.fechas[fechaISO].tareas[taskIndex].calidad) { appDB.fechas[fechaISO].tareas[taskIndex].calidad = 2; } window.guardarBaseDeDatos(); window.pintarDatosGuardados(); renderizarGraficos(); };
    window.setTaskQuality = function(fechaISO, taskIndex, calidad) { appDB.fechas[fechaISO].tareas[taskIndex].calidad = calidad; window.guardarBaseDeDatos(); window.pintarDatosGuardados(); };

    window.pintarDatosGuardados = function() {
        document.querySelectorAll('.day-context-box').forEach(el => el.innerHTML = ''); document.querySelectorAll('.task-list').forEach(el => el.innerHTML = ''); document.querySelectorAll('.md-badge').forEach(el => el.remove());
        let fechasPartidos = []; for (const [f, d] of Object.entries(appDB.fechas)) { if(d.evento === 'partido') fechasPartidos.push(new Date(f + "T12:00:00").getTime()); }

        for (const [fechaISO, data] of Object.entries(appDB.fechas)) {
            const contextBox = document.getElementById(`context-${fechaISO}`); const listBox = document.getElementById(`list-${fechaISO}`); const cardHeader = document.querySelector(`#card-${fechaISO} .day-header`);
            if(!contextBox || !listBox || !cardHeader) continue;

            if(fechasPartidos.length > 0 && data.evento !== 'partido') {
                let currentT = new Date(fechaISO + "T12:00:00").getTime(); let closestMatch = fechasPartidos.reduce((prev, curr) => Math.abs(curr - currentT) < Math.abs(prev - currentT) ? curr : prev); let diffDays = Math.round((currentT - closestMatch) / (1000 * 3600 * 24));
                if(diffDays >= -5 && diffDays <= 2) { let txtMD = diffDays > 0 ? `MD+${diffDays}` : `MD${diffDays}`; let colorClass = diffDays === -1 ? 'md-1' : (diffDays === -2 ? 'md-2' : ''); cardHeader.innerHTML += `<span class="md-badge ${colorClass}">${txtMD}</span>`; }
            }

            if(data.evento) { let evtHTML = ""; if(data.evento === 'descanso') evtHTML = `<span class="tag-evento evento-descanso">🌴 Día de Descanso</span>`; if(data.evento === 'partido') evtHTML = `<span class="tag-evento evento-partido">⚽ Día de Partido</span>`; if(data.evento === 'desplazamiento') evtHTML = `<span class="tag-evento evento-desplazamiento">🚌 Desplazamiento</span>`; listBox.innerHTML += evtHTML; }
            let ctx = data.contexto || {}; let transHTML = ctx.transversal || ""; if(transHTML.includes("http")) { transHTML = `<a href="${transHTML}" target="_blank" style="color: inherit; text-decoration: underline;">🎥 Ver Video-Scouting</a>`; }
            let htmlContexto = ""; if(ctx.condicional || ctx.emocional || ctx.transversal) { if(ctx.condicional) htmlContexto += `<span class="ctx-tag tag-condicional">⚡ ${ctx.condicional}</span>`; if(ctx.emocional) htmlContexto += `<span class="ctx-tag tag-emocional">🧠 ${ctx.emocional}</span>`; if(ctx.transversal) htmlContexto += `<span class="ctx-tag tag-transversal">📖 ${transHTML}</span>`; } else if (data.tareas && data.tareas.length > 0) { htmlContexto = `<span class="ctx-tag" style="background:#f0f0f5; color:#888; border:1px solid #ddd;">⚙️ Contexto no definido</span>`; }
            contextBox.innerHTML = htmlContexto;

            if(data.tareas) {
                data.tareas.forEach((tarea, index) => {
                    let colorClase = ""; let icono = "";
                    if(tarea.bloqueID === 'tecnica_defensiva') { colorClase = 'tec-def'; icono = '🛡️'; } else if(tarea.bloqueID === 'tecnica_ofensiva') { colorClase = 'tec-ofe'; icono = '⚔️'; } else if(tarea.bloqueID === 'tactica_defensiva') { colorClase = 'tac-def'; icono = '🛑'; } else if(tarea.bloqueID === 'tactica_ofensiva') { colorClase = 'tac-ofe'; icono = '🔥'; }
                    let natBadgeClass = tarea.naturaleza === 'analitica' ? 'nat-a' : (tarea.naturaleza === 'juego_real' ? 'nat-jr' : (tarea.naturaleza === 'semi_analitica' ? 'nat-sa' : 'nat-g')); let natText = tarea.naturaleza === 'analitica' ? '🧩 Analítica' : (tarea.naturaleza === 'juego_real' ? '⚔️ Juego Real' : (tarea.naturaleza === 'semi_analitica' ? '🌗 Semi-Analítica' : '🌐 Global')); let natHTML = `<span class="badge-nat ${natBadgeClass}">${natText}</span>`;
                    let statusClass = tarea.status === 'done' ? 'task-done' : (tarea.status === 'missed' ? 'task-missed' : '');
                    
                    let infoCarga = (tarea.duracion && tarea.rpe) ? `<span style="font-size:0.7rem; color:#d32f2f; font-weight:900;">⚡ ${tarea.carga} UA</span>` : ''; 
                    let viaSalidaHtml = tarea.viaSalida ? `<span style="font-size:0.65rem; background:#fff3e0; color:#e65100; padding:2px 5px; border-radius:4px; font-weight:bold; margin-left:5px;">➡️ Vía ${tarea.viaSalida}</span>` : '';
                    let cadenaHTML = tarea.encadenado ? `<div class="task-chain">➔ ${tarea.encadenado}</div>` : ''; 
                    let subTextoVisual = `<div style="display:flex; justify-content:space-between; align-items:center;"><span>${tarea.bloqueTexto.replace(icono, '').trim()}${viaSalidaHtml}</span> ${infoCarga}</div>`;
                    
                    let qualityHTML = '';
                    if(tarea.status === 'done' && currentUser && currentUser.role === 'trainer') { let q = tarea.calidad || 2; qualityHTML = `<div class="quality-controls" style="display:flex; justify-content:space-between; align-items:center; width:100%; border-top: 1px dashed rgba(0,0,0,0.1); margin-top:5px; padding-top:5px;"><span style="font-size:0.7rem; color:#666; font-weight:bold;">Calidad:</span><div><button class="btn-q ${q===3?'active-q-bien':''}" onclick="setTaskQuality('${fechaISO}', ${index}, 3)">🟢</button><button class="btn-q ${q===2?'active-q-reg':''}" onclick="setTaskQuality('${fechaISO}', ${index}, 2)">🟡</button><button class="btn-q ${q===1?'active-q-mal':''}" onclick="setTaskQuality('${fechaISO}', ${index}, 1)">🔴</button></div></div>`; }
                    
                    let statusBtns = (currentUser && currentUser.role === 'trainer') ? `<div style="display:flex; gap:5px;"><button class="btn-status" onclick="toggleTaskStatus('${fechaISO}', ${index}, 'done')">✅</button><button class="btn-status" onclick="toggleTaskStatus('${fechaISO}', ${index}, 'missed')">❌</button></div>` : ``;

                    listBox.innerHTML += `<div class="task-item ${colorClase} ${statusClass}"><div class="task-main"><span>${icono} ${tarea.gesto}</span> ${natHTML}</div><div class="task-sub">${subTextoVisual}</div>${cadenaHTML}<div class="task-status-bar">${statusBtns}</div>${qualityHTML}</div>`;
                });
            }
        }
        if(currentUser && currentUser.role === 'trainer') inicializarDragAndDrop();
    };

    const modal = document.getElementById('add-modal');
    window.abrirModal = (idUnico, tituloFormateado) => { 
        diaYsemanaActual = idUnico; 
        document.getElementById('modal-day-title').innerText = `Añadir a ${tituloFormateado}`; 
        let diaTieneDatos = false; 
        if(appDB.fechas[idUnico]) { 
            diaTieneDatos = true; 
            if(appDB.fechas[idUnico].evento) {
                document.getElementById('select-evento-especial').value = appDB.fechas[idUnico].evento;
                if(document.getElementById('select-evento-especial').dataset.customized) document.getElementById('select-evento-especial').dispatchEvent(new Event('change'));
            }
            if(appDB.fechas[idUnico].contexto) { 
                document.getElementById('input-condicional').value = appDB.fechas[idUnico].contexto.condicional || ""; 
                document.getElementById('input-emocional').value = appDB.fechas[idUnico].contexto.emocional || ""; 
                document.getElementById('input-transversal').value = appDB.fechas[idUnico].contexto.transversal || ""; 
            } 
        } 
        if(diaTieneDatos) { document.getElementById('btn-limpiar-dia').classList.remove('hidden'); } else { document.getElementById('btn-limpiar-dia').classList.add('hidden'); } 
        document.getElementById('input-duracion').value = ""; 
        modal.classList.remove('hidden'); 
    };

    window.cerrarModal = () => { 
        modal.classList.add('hidden'); 
        document.getElementById('smart-card-container').classList.add('hidden'); 
        document.getElementById('encadenamiento-container').classList.add('hidden'); 
        document.getElementById('btn-limpiar-dia').classList.add('hidden'); 
        
        ['select-evento-especial', 'select-bloque', 'select-encadenamiento', 'select-naturaleza', 'select-concepto', 'select-gesto', 'select-via-salida'].forEach(id => {
            let el = document.getElementById(id);
            if(el) {
                if(id === 'select-naturaleza') el.value = 'semi_analitica';
                else el.value = "";
                
                if(id === 'select-concepto' || id === 'select-gesto') {
                    el.innerHTML = `<option value="">${id === 'select-concepto' ? '2. Concepto...' : '3. Gesto Específico...'}</option>`;
                    el.disabled = true;
                }
                if(id === 'select-encadenamiento') el.innerHTML = '<option value="">Sin encadenamiento</option>';
                
                if(el.dataset.customized) el.dispatchEvent(new Event('change'));
            }
        });
        
        document.getElementById('playbook-container').classList.add('hidden'); 
        document.getElementById('input-condicional').value = ""; document.getElementById('input-emocional').value = ""; document.getElementById('input-transversal').value = ""; 
    };
    
    document.getElementById('btn-close-modal').addEventListener('click', window.cerrarModal);
    function mostrarAlerta(titulo, mensaje, esError, esWarningCognitivo = false) { const container = document.getElementById('alert-container'); let extraClass = esWarningCognitivo ? "warning-cog" : ""; let colorBorder = esError ? '#CB3524' : (esWarningCognitivo ? '#FF9800' : '#4CAF50'); if(esError && titulo.includes("MÉDICA")) extraClass = "critical-med"; container.innerHTML = `<div class="alert-box ${extraClass}" style="border-left-color: ${colorBorder}"><strong>${titulo}</strong><br>${mensaje}</div>`; setTimeout(() => container.innerHTML = '', 4500); }

    const autogenModal = document.getElementById('autogen-modal'); document.getElementById('btn-open-autogen').addEventListener('click', () => autogenModal.classList.remove('hidden')); document.getElementById('btn-close-autogen').addEventListener('click', () => autogenModal.classList.add('hidden')); function getLeastUsedTask(poolArray) { let minReps = Infinity; let bestTask = poolArray[0]; poolArray.forEach(task => { let reps = appDB.statsGestos[task.g] || 0; if(reps < minReps) { minReps = reps; bestTask = task; } }); return bestTask; }
    
    // IA Generador Sanitizado
    document.getElementById('btn-ejecutar-ia').addEventListener('click', () => {
        let diaPartido = parseInt(document.getElementById('ia-dia-partido').value); let perfilRival = document.getElementById('ia-perfil-rival').value; let trainingDaysNodes = document.querySelectorAll('input[name="ia-train-day"]:checked'); let trainingDays = Array.from(trainingDaysNodes).map(cb => parseInt(cb.value));
        if(trainingDays.length === 0) { alert("Selecciona al menos un día de entrenamiento."); return; } const hoy = new Date(); let lunes = getMonday(hoy);
        for(let i=0; i<7; i++) { let fd = new Date(lunes); fd.setDate(fd.getDate() + i); let iso = toLocalISO(fd); if(appDB.fechas[iso]) { let tareas = appDB.fechas[iso].tareas || []; tareas.forEach(t => { if(t.bloqueID && appDB.statsBloques[t.bloqueID]) appDB.statsBloques[t.bloqueID] = Math.max(0, appDB.statsBloques[t.bloqueID]-1); if(t.gesto && appDB.statsGestos[t.gesto]) appDB.statsGestos[t.gesto] = Math.max(0, appDB.statsGestos[t.gesto]-1); }); delete appDB.fechas[iso]; } }
        
        const pools = { 
            directo: { tecnica: [{b:"tecnica_defensiva", t:"🛡️ Técnica Defensiva", g:"Despeje orientado", c:2}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Remate de cabeza", c:2}], tactica: [{b:"tactica_defensiva", t:"🛑 Táctica Defensiva", g:"Bloque Bajo", c:3}, {b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Contraataque directo", c:3, v:"larga"}] }, 
            combinativo: { tecnica: [{b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Pase corto (Interior)", c:2}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Control orientado", c:2}], tactica: [{b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Salida desde portería (Corto)", c:3, v:"corta"}, {b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Juego interior (Pasillos centrales)", c:3, v:"media"}] }, 
            transiciones: { tecnica: [{b:"tecnica_defensiva", t:"🛡️ Técnica Defensiva", g:"Anticipación", c:3}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Conducción para fijar", c:2}], tactica: [{b:"tactica_defensiva", t:"🛑 Táctica Defensiva", g:"Presión tras pérdida (Inmediata)", c:3}, {b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Ataque rápido (Despliegue)", c:3, v:"larga"}] }, 
            bloque_bajo: { tecnica: [{b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Tiro de precisión (Interior)", c:2}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Centro lateral", c:2}], tactica: [{b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Amplitud (Juego exterior)", c:3}, {b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Fijar y dividir", c:3}] }, 
            bloque_medio: { tecnica: [{b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Pase filtrado", c:2}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Cambio de orientación", c:2}], tactica: [{b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Tercer hombre", c:3, v:"media"}, {b:"tactica_defensiva", t:"🛑 Táctica Defensiva", g:"Basculación de línea", c:2}] }, 
            bloque_alto: { tecnica: [{b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Pase largo (Empeine)", c:3}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Protección del balón", c:2}], tactica: [{b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Salida directa (Juego en largo)", c:3, v:"larga"}, {b:"tactica_defensiva", t:"🛑 Táctica Defensiva", g:"Achique de espacios (Tirar la línea)", c:3, v:"larga"}] }, 
            abp: { tecnica: [{b:"tecnica_defensiva", t:"🛡️ Técnica Defensiva", g:"Marcaje al hombre", c:2}, {b:"tecnica_ofensiva", t:"⚔️ Técnica Ofensiva", g:"Remate de cabeza", c:3}], tactica: [{b:"tactica_defensiva", t:"🛑 Táctica Defensiva", g:"Defensa de Córner (Zonal/Mixta)", c:3}, {b:"tactica_ofensiva", t:"🔥 Táctica Ofensiva", g:"Jugadas de estrategia", c:3}] } 
        };
        for(let i=0; i<7; i++) { let fd = new Date(lunes); fd.setDate(fd.getDate() + i); let iso = toLocalISO(fd); let jsDay = fd.getDay() === 0 ? 7 : fd.getDay(); let MD = jsDay - diaPartido; appDB.fechas[iso] = { evento: "", contexto: { condicional:"", emocional:"", transversal:"" }, tareas: [] }; if(jsDay === diaPartido) { appDB.fechas[iso].evento = "partido"; appDB.fechas[iso].contexto.emocional = "Foco competitivo"; } else if (trainingDays.includes(jsDay)) { let tTec = getLeastUsedTask(pools[perfilRival].tecnica); let tTac = getLeastUsedTask(pools[perfilRival].tactica); if (MD === -1) { appDB.fechas[iso].contexto.condicional = "Activación Pre-Partido"; appDB.fechas[iso].tareas.push({bloqueID:"tactica_ofensiva", bloqueTexto:"🔥 Táctica Ofensiva", gesto:"Jugadas de estrategia", encadenado:"", cognitiva:1, status:'planned', naturaleza: 'analitica', calidad:0, duracion: 10, rpe: 3, carga: 30}); appDB.statsBloques["tactica_ofensiva"] = (appDB.statsBloques["tactica_ofensiva"]||0)+1; appDB.statsGestos["Jugadas de estrategia"] = (appDB.statsGestos["Jugadas de estrategia"]||0)+1; } else if (Math.abs(MD) === 2 || MD === -2) { appDB.fechas[iso].contexto.condicional = "Velocidad de Reacción y Reducidos"; appDB.fechas[iso].tareas.push({bloqueID:"tecnica_ofensiva", bloqueTexto:"⚔️ Técnica Ofensiva", gesto:"Regate en 1vs1 (Desborde)", encadenado:"", cognitiva:3, status:'planned', naturaleza: 'juego_real', calidad:0, duracion: 15, rpe: 8, carga: 120}); appDB.statsBloques["tecnica_ofensiva"] = (appDB.statsBloques["tecnica_ofensiva"]||0)+1; appDB.statsGestos["Regate en 1vs1 (Desborde)"] = (appDB.statsGestos["Regate en 1vs1 (Desborde)"]||0)+1; } else { appDB.fechas[iso].contexto.condicional = "Fuerza Específica / Resistencia"; appDB.fechas[iso].tareas.push({bloqueID:tTec.b, bloqueTexto:tTec.t, gesto:tTec.g, encadenado:"", cognitiva:tTec.c, status:'planned', naturaleza: 'semi_analitica', calidad:0, duracion: 20, rpe: 6, carga: 120}); appDB.fechas[iso].tareas.push({bloqueID:tTac.b, bloqueTexto:tTac.t, gesto:tTac.g, encadenado:"", cognitiva:tTac.c, status:'planned', naturaleza: 'global', calidad:0, duracion: 25, rpe: 7, carga: 175, viaSalida: tTac.v || null}); appDB.statsBloques[tTec.b] = (appDB.statsBloques[tTec.b]||0)+1; appDB.statsGestos[tTec.g] = (appDB.statsGestos[tTec.g]||0)+1; appDB.statsBloques[tTac.b] = (appDB.statsBloques[tTac.b]||0)+1; appDB.statsGestos[tTac.g] = (appDB.statsGestos[tTac.g]||0)+1; } } else { appDB.fechas[iso].evento = "descanso"; } }
        window.guardarBaseDeDatos(); window.pintarDatosGuardados(); autogenModal.classList.add('hidden'); mostrarAlerta("🪄 IA Mágica", "Semana generada asegurando máxima variabilidad de equipo.", false);
    });

    const importModal = document.getElementById('import-text-modal'); document.getElementById('btn-open-import').addEventListener('click', () => importModal.classList.remove('hidden')); document.getElementById('btn-close-import').addEventListener('click', () => importModal.classList.add('hidden'));
    
    // Importador Sanitizado
    document.getElementById('btn-process-text').addEventListener('click', () => {
        const text = document.getElementById('ia-raw-text').value; if(!text) return; let lines = text.split('\n').map(l => l.trim()).filter(l => l !== ""); let currentWeekOffset = 0; let fechaBase = getPrimerLunesMeso(new Date()); let tareasAñadidas = 0;
        for (let i = 0; i < lines.length; i++) {
            let l = lines[i]; if(l.toUpperCase().includes('MICROCICLO')) { let match = l.match(/MICROCICLO\s*(\d+)/i); if(match) { currentWeekOffset = parseInt(match[1]) - 1; } else { currentWeekOffset++; } continue; }
            let celdas = l.split(/\t/); if(celdas.length < 3) celdas = l.split(/\s{3,}/); let diaTexto = celdas[0].toUpperCase(); let diasValidos = ['L', 'M', 'X', 'J', 'V', 'S', 'D', 'LUNES', 'MARTES', 'MIÉRCOLES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'SABADO', 'DOMINGO'];
            if (celdas.length === 1 && diasValidos.includes(diaTexto)) { if (i + 6 < lines.length) { celdas = [diaTexto, lines[i+1], lines[i+2], lines[i+3], lines[i+4], lines[i+5], lines[i+6]]; i += 6; } }
            if(celdas.length >= 3) {
                let offsetDia = -1; diaTexto = celdas[0].toUpperCase(); if(diaTexto === 'L' || diaTexto === 'LUNES') offsetDia = 0; else if(diaTexto === 'M' || diaTexto === 'MARTES') offsetDia = 1; else if(diaTexto === 'X' || diaTexto === 'MIÉRCOLES' || diaTexto === 'MIERCOLES') offsetDia = 2; else if(diaTexto === 'J' || diaTexto === 'JUEVES') offsetDia = 3; else if(diaTexto === 'V' || diaTexto === 'VIERNES') offsetDia = 4; else if(diaTexto === 'S' || diaTexto === 'SÁBADO' || diaTexto === 'SABADO') offsetDia = 5; else if(diaTexto === 'D' || diaTexto === 'DOMINGO') offsetDia = 6;
                if(offsetDia !== -1) {
                    let fechaDestino = new Date(fechaBase.getTime()); fechaDestino.setHours(12, 0, 0, 0); fechaDestino.setDate(fechaDestino.getDate() + (currentWeekOffset * 7) + offsetDia); let iso = toLocalISO(fechaDestino); 
                    if(!appDB.fechas[iso]) appDB.fechas[iso] = { evento: "", contexto: { condicional:"", emocional:"", transversal:"" }, tareas: [] };
                    let tecDef = celdas[1] ? celdas[1].trim() : ""; let tecOf = celdas[2] ? celdas[2].trim() : ""; let tacDef = celdas[3] ? celdas[3].trim() : ""; let tacOf = celdas[4] ? celdas[4].trim() : ""; let cond = celdas[5] ? celdas[5].trim() : ""; let emo = celdas[6] ? celdas[6].trim() : ""; let ignorar = ["TÉCNICA", "TECNICA", "TÁCTICA", "TACTICA", "CONDICIONAL", "EMOCIONAL", "DÍA", "DIA"];
                    if (tecDef && !ignorar.some(palabra => tecDef.toUpperCase().includes(palabra))) { appDB.fechas[iso].tareas.push({ bloqueID: "tecnica_defensiva", bloqueTexto: "🛡️ Téc. Defensiva", gesto: tecDef, encadenado: "", cognitiva: 2, status: 'planned', naturaleza: 'semi_analitica', calidad: 0, duracion: 15, rpe: 5, carga: 75 }); appDB.statsBloques["tecnica_defensiva"]=(appDB.statsBloques["tecnica_defensiva"]||0)+1; appDB.statsGestos[tecDef] = (appDB.statsGestos[tecDef] || 0) + 1; tareasAñadidas++;}
                    if (tecOf && !ignorar.some(palabra => tecOf.toUpperCase().includes(palabra))) { appDB.fechas[iso].tareas.push({ bloqueID: "tecnica_ofensiva", bloqueTexto: "⚔️ Téc. Ofensiva", gesto: tecOf, encadenado: "", cognitiva: 2, status: 'planned', naturaleza: 'semi_analitica', calidad: 0, duracion: 15, rpe: 5, carga: 75 }); appDB.statsBloques["tecnica_ofensiva"]=(appDB.statsBloques["tecnica_ofensiva"]||0)+1; appDB.statsGestos[tecOf] = (appDB.statsGestos[tecOf] || 0) + 1; tareasAñadidas++;}
                    if (tacDef && !ignorar.some(palabra => tacDef.toUpperCase().includes(palabra))) { appDB.fechas[iso].tareas.push({ bloqueID: "tactica_defensiva", bloqueTexto: "🛑 Tác. Defensiva", gesto: tacDef, encadenado: "", cognitiva: 3, status: 'planned', naturaleza: 'semi_analitica', calidad: 0, duracion: 20, rpe: 6, carga: 120 }); appDB.statsBloques["tactica_defensiva"]=(appDB.statsBloques["tactica_defensiva"]||0)+1; appDB.statsGestos[tacDef] = (appDB.statsGestos[tacDef] || 0) + 1; tareasAñadidas++;}
                    if (tacOf && !ignorar.some(palabra => tacOf.toUpperCase().includes(palabra))) { appDB.fechas[iso].tareas.push({ bloqueID: "tactica_ofensiva", bloqueTexto: "🔥 Tác. Ofensiva", gesto: tacOf, encadenado: "", cognitiva: 3, status: 'planned', naturaleza: 'semi_analitica', calidad: 0, duracion: 20, rpe: 6, carga: 120, viaSalida: "corta" }); appDB.statsBloques["tactica_ofensiva"]=(appDB.statsBloques["tactica_ofensiva"]||0)+1; appDB.statsGestos[tacOf] = (appDB.statsGestos[tacOf] || 0) + 1; tareasAñadidas++;}
                    let ctx = appDB.fechas[iso].contexto || {}; if(cond && !ignorar.some(palabra => cond.toUpperCase().includes(palabra))) ctx.condicional = cond; if(emo && !ignorar.some(palabra => emo.toUpperCase().includes(palabra))) ctx.emocional = emo; appDB.fechas[iso].contexto = ctx;
                }
            }
        }
        window.guardarBaseDeDatos(); window.pintarDatosGuardados(); importModal.classList.add('hidden'); document.getElementById('ia-raw-text').value = ""; mostrarAlerta("🤖 Traductor Completado", `Se han volcado ${tareasAñadidas} tareas al mes actual.`, false);
    });

    // COMPARATIVA HISTÓRICA
    function poblarSelectoresComparativa() {
        let mesesUnicos = new Set(); Object.keys(appDB.fechas).forEach(iso => { mesesUnicos.add(iso.substring(0, 7)); }); let mesesArr = Array.from(mesesUnicos).sort(); let selA = document.getElementById('compare-mes-a'); let selB = document.getElementById('compare-mes-b'); selA.innerHTML = ''; selB.innerHTML = '';
        if(mesesArr.length === 0) { selA.innerHTML = '<option value="">Sin datos</option>'; selB.innerHTML = '<option value="">Sin datos</option>'; return; }
        const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        mesesArr.forEach(ym => { let [y, m] = ym.split('-'); let nombre = `${nombresMeses[parseInt(m)-1]} ${y}`; selA.innerHTML += `<option value="${ym}">${nombre}</option>`; selB.innerHTML += `<option value="${ym}">${nombre}</option>`; });
        if(mesesArr.length > 1) { selB.value = mesesArr[mesesArr.length-2]; selA.value = mesesArr[mesesArr.length-1]; }
    }
    function extraerStatsMes(yearMonth) {
        let s = { tec_def:0, tec_ofe:0, tac_def:0, tac_ofe:0, totalTareasCog:0, totalCog:0 };
        Object.keys(appDB.fechas).forEach(iso => { if(iso.startsWith(yearMonth) && appDB.fechas[iso].tareas) { appDB.fechas[iso].tareas.forEach(t => { if(t.bloqueID === 'tecnica_defensiva') s.tec_def++; if(t.bloqueID === 'tecnica_ofensiva') s.tec_ofe++; if(t.bloqueID === 'tactica_defensiva') s.tac_def++; if(t.bloqueID === 'tactica_ofensiva') s.tac_ofe++; if(t.status !== 'missed') { s.totalTareasCog++; s.totalCog += (t.cognitiva || 2); } }); } });
        return s;
    }
    document.getElementById('btn-ejecutar-comparativa').addEventListener('click', () => {
        let valA = document.getElementById('compare-mes-a').value; let valB = document.getElementById('compare-mes-b').value; if(!valA || !valB) return alert("Faltan meses por seleccionar.");
        let labelA = document.getElementById('compare-mes-a').options[document.getElementById('compare-mes-a').selectedIndex].text; let labelB = document.getElementById('compare-mes-b').options[document.getElementById('compare-mes-b').selectedIndex].text;
        let statsA = extraerStatsMes(valA); let statsB = extraerStatsMes(valB);
        if(compareRadarChartInstance) compareRadarChartInstance.destroy();
        const ctxRadarCmp = document.getElementById('compareRadarChart').getContext('2d'); compareRadarChartInstance = new Chart(ctxRadarCmp, { type: 'radar', data: { labels: ['Téc. Defensiva', 'Téc. Ofensiva', 'Tác. Ofensiva', 'Tác. Defensiva'], datasets: [ { label: labelA, data: [statsA.tec_def, statsA.tec_ofe, statsA.tac_ofe, statsA.tac_def], backgroundColor: 'rgba(0, 51, 102, 0.3)', borderColor: '#003366', pointBackgroundColor: '#003366', borderWidth: 2 }, { label: labelB, data: [statsB.tec_def, statsB.tec_ofe, statsB.tac_ofe, statsB.tac_def], backgroundColor: 'rgba(230, 81, 0, 0.3)', borderColor: '#e65100', pointBackgroundColor: '#e65100', borderWidth: 2 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true } } } });
        const actThermo = (idStatus, idBar, s) => { let avg = s.totalTareasCog > 0 ? (s.totalCog / s.totalTareasCog) : 0; document.getElementById(idBar).style.width = `${(avg/3)*100}%`; document.getElementById(idBar).className = 'thermo-fill ' + (avg < 1.6 ? 'thermo-low' : (avg < 2.5 ? 'thermo-med' : 'thermo-high')); document.getElementById(idStatus).innerText = avg === 0 ? "Sin datos" : avg.toFixed(1); };
        actThermo('thermo-status-a', 'thermo-compare-a', statsA); actThermo('thermo-status-b', 'thermo-compare-b', statsB); document.getElementById('compare-results-container').classList.remove('hidden');
    });

    // GRÁFICOS Y AUDITORÍA GENERAL
    function renderizarGraficos() {
        let stats = appDB.statsBloques;
        if(adnChartInstance) adnChartInstance.destroy(); if(balanceChartInstance) balanceChartInstance.destroy(); if(realizadoChartInstance) realizadoChartInstance.destroy(); if(cargaChartInstance) cargaChartInstance.destroy(); if(matrizChartInstance) matrizChartInstance.destroy();

        const ctxRadar = document.getElementById('adnChart').getContext('2d'); adnChartInstance = new Chart(ctxRadar, { type: 'radar', data: { labels: ['Téc. Defensiva', 'Téc. Ofensiva', 'Tác. Ofensiva', 'Tác. Defensiva'], datasets: [{ label: `Carga Metodológica`, data: [stats.tecnica_defensiva, stats.tecnica_ofensiva, stats.tactica_ofensiva, stats.tactica_defensiva], backgroundColor: 'rgba(203, 53, 36, 0.4)', borderColor: '#CB3524', pointBackgroundColor: '#003366' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true } } } });
        const ctxPie = document.getElementById('balanceChart').getContext('2d'); balanceChartInstance = new Chart(ctxPie, { type: 'doughnut', data: { labels: ['🛡️ Téc. Defensiva', '⚔️ Téc. Ofensiva', '🛑 Tác. Defensiva', '🔥 Tác. Ofensiva'], datasets: [{ data: [stats.tecnica_defensiva, stats.tecnica_ofensiva, stats.tactica_defensiva, stats.tactica_ofensiva], backgroundColor: ['#003366', '#00acc1', '#CB3524', '#ff9800'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });

        let totalPlan = 0; let totalReal = 0; let cA = 0, cSA = 0, cG = 0, cJR = 0; let cargasSemanales = {}; let maxSemana = 1; let playbook = { corta: 0, media: 0, larga: 0, total: 0 }; let mData = { 'analitica': [0,0,0,0], 'semi_analitica': [0,0,0,0], 'global': [0,0,0,0], 'juego_real': [0,0,0,0] };
        
        for (const [f, data] of Object.entries(appDB.fechas)) {
            let fechaDate = new Date(f + "T12:00:00"); let lunesBase = getPrimerLunesMeso(fechaDate); let numSemana = Math.floor(Math.floor((fechaDate - lunesBase) / (24 * 60 * 60 * 1000)) / 7) + 1;
            if(!cargasSemanales[numSemana]) cargasSemanales[numSemana] = 0; if(numSemana > maxSemana) maxSemana = numSemana;
            if(data.tareas) { data.tareas.forEach(t => { totalPlan++; if(t.carga) cargasSemanales[numSemana] += t.carga; if(t.status === 'done') totalReal++; if(t.naturaleza === 'analitica') cA++; if(t.naturaleza === 'semi_analitica') cSA++; if(t.naturaleza === 'global') cG++; if(t.naturaleza === 'juego_real') cJR++; if(t.naturaleza && mData[t.naturaleza]) { if(t.bloqueID === 'tecnica_defensiva') mData[t.naturaleza][0]++; if(t.bloqueID === 'tecnica_ofensiva') mData[t.naturaleza][1]++; if(t.bloqueID === 'tactica_defensiva') mData[t.naturaleza][2]++; if(t.bloqueID === 'tactica_ofensiva') mData[t.naturaleza][3]++; } if(t.bloqueID === 'tactica_ofensiva' && t.viaSalida) { if(t.viaSalida === 'corta') playbook.corta++; if(t.viaSalida === 'media') playbook.media++; if(t.viaSalida === 'larga') playbook.larga++; playbook.total++; } }); }
        }
        
        const ctxBar = document.getElementById('realizadoChart').getContext('2d'); realizadoChartInstance = new Chart(ctxBar, { type: 'bar', data: { labels: ['Auditoría de Tareas'], datasets: [ { label: 'Planificadas', data: [totalPlan], backgroundColor: '#003366' }, { label: 'Realmente Ejecutadas', data: [totalReal], backgroundColor: '#4CAF50' } ] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' } });
        let labelsCarga = []; let dataCarga = []; for(let i=1; i<=maxSemana; i++) { labelsCarga.push(`Micro ${i}`); dataCarga.push(cargasSemanales[i] || 0); }
        const ctxCarga = document.getElementById('cargaChart').getContext('2d'); cargaChartInstance = new Chart(ctxCarga, { type: 'bar', data: { labels: labelsCarga, datasets: [ { label: 'Unidades de Carga (UA)', data: dataCarga, backgroundColor: '#FF9800', borderRadius: 8 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });

        const ctxMatriz = document.getElementById('matrizChart').getContext('2d'); matrizChartInstance = new Chart(ctxMatriz, { type: 'bar', data: { labels: ['🛡️ Téc Def', '⚔️ Téc Ofe', '🛑 Tác Def', '🔥 Tác Ofe'], datasets: [ { label: 'Analítica', data: [mData.analitica[0], mData.analitica[1], mData.analitica[2], mData.analitica[3]], backgroundColor: '#9E9E9E' }, { label: 'Semi-Analítica', data: [mData.semi_analitica[0], mData.semi_analitica[1], mData.semi_analitica[2], mData.semi_analitica[3]], backgroundColor: '#FF9800' }, { label: 'Global', data: [mData.global[0], mData.global[1], mData.global[2], mData.global[3]], backgroundColor: '#2196f3' }, { label: 'Juego Real', data: [mData.juego_real[0], mData.juego_real[1], mData.juego_real[2], mData.juego_real[3]], backgroundColor: '#F44336' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });

        let pCorta = playbook.total > 0 ? Math.round((playbook.corta / playbook.total) * 100) : 0; let pMedia = playbook.total > 0 ? Math.round((playbook.media / playbook.total) * 100) : 0; let pLarga = playbook.total > 0 ? Math.round((playbook.larga / playbook.total) * 100) : 0;
        document.getElementById('playbook-corta-pct').innerText = pCorta + '%'; document.getElementById('playbook-corta-bar').style.width = pCorta + '%'; document.getElementById('playbook-media-pct').innerText = pMedia + '%'; document.getElementById('playbook-media-bar').style.width = pMedia + '%'; document.getElementById('playbook-larga-pct').innerText = pLarga + '%'; document.getElementById('playbook-larga-bar').style.width = pLarga + '%';

        let ratioOfensivo = totalPlan > 0 ? ((stats.tecnica_ofensiva + stats.tactica_ofensiva) / totalPlan) * 100 : 0; let ratioDefensivo = totalPlan > 0 ? ((stats.tecnica_defensiva + stats.tactica_defensiva) / totalPlan) * 100 : 0; let ratioTactico = totalPlan > 0 ? ((stats.tactica_defensiva + stats.tactica_ofensiva) / totalPlan) * 100 : 0; let ratioTecnico = totalPlan > 0 ? ((stats.tecnica_defensiva + stats.tecnica_ofensiva) / totalPlan) * 100 : 0;
        let objTitle = document.getElementById('obj-title'); let objDesc = document.getElementById('obj-desc'); let objContainer = document.getElementById('objetivo-status-container');
        if (totalPlan === 0) { objTitle.innerText = "Esperando tareas..."; objDesc.innerText = "Añade planificación."; objContainer.style.borderLeftColor = "#ccc"; } 
        else {
            let cumplido = false; let mensaje = "";
            if (appDB.objetivoCiclo === "equilibrio") { cumplido = (ratioOfensivo >= 35 && ratioOfensivo <= 65); mensaje = `Equilibrio: Ofe ${ratioOfensivo.toFixed(1)}% / Def ${ratioDefensivo.toFixed(1)}%.`; } else if (appDB.objetivoCiclo === "ofensivo" || appDB.objetivoCiclo === "transiciones") { cumplido = (ratioOfensivo >= 40); mensaje = `Ofensivo: ${ratioOfensivo.toFixed(1)}% (Mín: 40%).`; } else if (appDB.objetivoCiclo === "defensivo" || appDB.objetivoCiclo === "espacios") { cumplido = (ratioDefensivo >= 55); mensaje = `Defensivo: ${ratioDefensivo.toFixed(1)}% (Mín: 55%).`; } else if (appDB.objetivoCiclo === "tactico" || appDB.objetivoCiclo === "juego_aereo") { cumplido = (ratioTactico >= 45); mensaje = `Táctico: ${ratioTactico.toFixed(1)}% (Mín: 45%).`; } else if (appDB.objetivoCiclo === "reaccion") { cumplido = (ratioTecnico >= 50); mensaje = `Técnico: ${ratioTecnico.toFixed(1)}% (Mín: 50%).`; }
            objTitle.innerText = cumplido ? "✅ Objetivo en Vías" : "⚠️ Objetivo en Riesgo"; objTitle.style.color = cumplido ? "#2e7d32" : "#c62828"; objContainer.style.borderLeftColor = cumplido ? "#4CAF50" : "#F44336"; objDesc.innerText = mensaje;
        }

        let totalTareasCog = 0; let totalCog = 0; for (const [f, data] of Object.entries(appDB.fechas)) { if(data.tareas) { data.tareas.forEach(t => { if(t.status !== 'missed') { totalTareasCog++; totalCog += (t.cognitiva || 2); } }); } }
        let avgCog = totalTareasCog > 0 ? (totalCog / totalTareasCog) : 0; let percentThermo = (avgCog / 3) * 100;
        document.getElementById('thermo-bar').style.width = `${percentThermo}%`; document.getElementById('thermo-bar').className = 'thermo-fill ' + (avgCog < 1.6 ? 'thermo-low' : (avgCog < 2.5 ? 'thermo-med' : 'thermo-high')); document.getElementById('thermo-status').innerText = avgCog === 0 ? "Sin datos" : (avgCog < 1.6 ? "Baja" : (avgCog < 2.5 ? "Media" : "Alta"));

        let totalEsp = cA + cSA + cG + cJR;
        if(totalEsp > 0) {
            let pA = (cA/totalEsp)*100; let pSA = (cSA/totalEsp)*100; let pG = (cG/totalEsp)*100; let pJR = (cJR/totalEsp)*100;
            document.getElementById('especificidad-bar').innerHTML = `<div style="width:${pA}%; background:#9E9E9E;" title="Analítica"></div><div style="width:${pSA}%; background:#FF9800;" title="Semi-Analítica"></div><div style="width:${pG}%; background:#2196f3;" title="Global"></div><div style="width:${pJR}%; background:#F44336;" title="Juego Real"></div>`; document.getElementById('especificidad-text').innerHTML = `<b>A:</b> ${pA.toFixed(0)}% | <b>SA:</b> ${pSA.toFixed(0)}% | <b>G:</b> ${pG.toFixed(0)}% | <b>JR:</b> ${pJR.toFixed(0)}%`;
            document.getElementById('alerta-md2').innerHTML = pA > 50 ? `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:6px; font-size:0.75rem; border-left:3px solid #c62828;">⚠️ Exceso tareas Analíticas (${pA.toFixed(0)}%).</div>` : "";
        } else { document.getElementById('especificidad-bar').innerHTML = `<div style="width:100%; background:#eee;"></div>`; document.getElementById('especificidad-text').innerHTML = "Sin datos."; document.getElementById('alerta-md2').innerHTML = ""; }
    }

    // ==========================================
    // 7. EXPORTACIÓN A PDF - CÓDIGO ORIGINAL QUE FUNCIONA
    // ==========================================
    
    document.getElementById('btn-export-calendario').addEventListener('click', () => { 
        mostrarAlerta("⏳ Generando Informe", "Construyendo documento PDF premium...", false);
        
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const tipoCiclo = document.getElementById('select-ciclo').value;
        let fechaInicioIteracion, numSemanas = 0;
        let txtCicloPortada = "";

        if (tipoCiclo === 'micro') { fechaInicioIteracion = getMonday(hoy); numSemanas = 1; txtCicloPortada = "MICROCICLO SEMANAL"; } 
        else if (tipoCiclo === 'meso') { let primerLunes = getPrimerLunesMeso(hoy); let ultimoLunes = getUltimoLunesMeso(hoy); fechaInicioIteracion = new Date(primerLunes); numSemanas = Math.round((ultimoLunes - primerLunes) / (7 * 24 * 60 * 60 * 1000)) + 1; txtCicloPortada = "MESOCICLO MENSUAL"; } 
        else if (tipoCiclo === 'macro') { let startYear = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1; let dAgosto = new Date(startYear, 7, 1); fechaInicioIteracion = getPrimerLunesMeso(dAgosto); let dJunio = new Date(startYear + 1, 5, 30); let ultimoLunes = getUltimoLunesMeso(dJunio); numSemanas = Math.round((ultimoLunes - fechaInicioIteracion) / (7 * 24 * 60 * 60 * 1000)) + 1; txtCicloPortada = "MACROCICLO ANUAL"; }

        let fechasPartidos = []; 
        for (const [f, d] of Object.entries(appDB.fechas)) { if(d.evento === 'partido') fechasPartidos.push(new Date(f + "T12:00:00").getTime()); }

        let html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; background: #fff; width: 297mm; min-height: 210mm;">`;
        
        // Lógica de fechas
        const mesesTexto = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        let dFinCiclo = new Date(fechaInicioIteracion);
        dFinCiclo.setDate(dFinCiclo.getDate() + (numSemanas * 7) - 1);
        let strFechas = `DEL ${fechaInicioIteracion.getDate()} DE ${mesesTexto[fechaInicioIteracion.getMonth()]} AL ${dFinCiclo.getDate()} DE ${mesesTexto[dFinCiclo.getMonth()]}`;

        // --- PORTADA PREMIUM ESTABLE (COLOR SOLIDO AZUL Y ESCUDO) ---
        html += `
        <div style="width: 297mm; height: 205mm; background-color: #003366; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; position: relative; overflow: hidden; page-break-after: always; box-sizing: border-box; text-align: center; border-bottom: 25px solid #CB3524;">
            
            <img src="ESCUDO_ATM.png" style="height: 220px; margin-bottom: 40px; z-index: 2;">
            
            <h1 style="font-size: 55px; font-weight: 900; margin: 0; letter-spacing: 3px; z-index: 2;">PLANIFICACIÓN METODOLÓGICA</h1>
            
            <div style="height: 5px; width: 150px; background-color: #FF9800; margin: 25px auto; z-index: 2;"></div>
            
            <h2 style="font-size: 28px; font-weight: 300; margin: 0; z-index: 2; color: #f0f0f0; letter-spacing: 5px;">METODOLOGY ATM</h2>
            
            <div style="margin-top: 50px; background-color: rgba(255, 255, 255, 0.1); padding: 15px 50px; border-radius: 50px; border: 2px solid rgba(255,255,255,0.3); z-index: 2;">
                <span style="font-size: 24px; font-weight: bold; color: #FF9800; text-transform: uppercase; letter-spacing: 2px; display: block;">${txtCicloPortada}</span>
                <span style="font-size: 15px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">${strFechas}</span>
            </div>
            
            <p style="position: absolute; bottom: 30px; font-size: 13px; color: #aaaaaa; z-index: 2; font-weight: bold; letter-spacing: 1px;">ÁREA DE DESARROLLO METODOLÓGICO</p>
        </div>
        `;

        // --- PÁGINAS DE CONTENIDO ---
        for (let s = 0; s < numSemanas; s++) {
            let fechaSemana = new Date(fechaInicioIteracion); fechaSemana.setDate(fechaSemana.getDate() + (s * 7));
            let pageBreak = s < numSemanas - 1 ? 'page-break-after: always;' : ''; 

            html += `<div style="${pageBreak} width: 297mm; height: 205mm; padding: 10mm; box-sizing: border-box; background: white; display: flex; flex-direction: column;">`;
            
            html += `
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 3px solid #003366; padding-bottom: 12px; margin-bottom: 20px;">
                    <div style="flex: 1;">
                        <h1 style="color: #003366; margin:0; font-size:24px; text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">Planificación Metodológica</h1>
                        <h2 style="color: #CB3524; margin:5px 0 0 0; font-size:14px; font-weight: bold; text-transform: uppercase;">Metodology ATM - Área de Desarrollo</h2>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <img src="ESCUDO_ATM.png" style="height: 45px;">
                    </div>
                    <div style="flex: 1; text-align: right;">
                        <h3 style="margin:0; font-size: 16px; color: #444; font-weight: bold;">${formatWeekTitle(fechaSemana)}</h3>
                        <p style="margin:5px 0 0 0; font-size: 13px; color: #888; text-transform: uppercase; font-weight: 600;">Ciclo: ${tipoCiclo}</p>
                    </div>
                </div>
            `;

            html += `<div style="display: flex; gap: 10px; width: 100%; flex-grow: 1; align-items: stretch;">`;
            
            for (let d = 0; d < 7; d++) {
                let fechaDia = new Date(fechaSemana); fechaDia.setDate(fechaDia.getDate() + d); let iso = toLocalISO(fechaDia);
                let data = appDB.fechas[iso] || {};

                html += `<div style="flex: 1; border: 1px solid #e1e5eb; border-top: 5px solid #003366; border-radius: 10px; padding: 12px; background: #fdfdff; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">`;
                
                html += `<div style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <span style="font-weight: 900; color: #003366; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">${fechaDia.toLocaleDateString('es-ES', {weekday: 'long'})}</span><br>
                                <span style="color: #777; font-size: 12px; font-weight: 600;">${fechaDia.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'})}</span>
                            </div>`;
                
                if(fechasPartidos.length > 0 && data.evento !== 'partido') {
                    let currentT = fechaDia.getTime();
                    let closestMatch = fechasPartidos.reduce((prev, curr) => Math.abs(curr - currentT) < Math.abs(prev - currentT) ? curr : prev);
                    let diffDays = Math.round((currentT - closestMatch) / (1000 * 3600 * 24));
                    if(diffDays >= -5 && diffDays <= 2) { 
                        let txtMD = diffDays > 0 ? `MD+${diffDays}` : `MD${diffDays}`; 
                        let bgMD = diffDays === -1 ? '#CB3524' : (diffDays === -2 ? '#FF9800' : '#333');
                        html += `<span style="background: ${bgMD}; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; height: fit-content;">${txtMD}</span>`;
                    }
                }
                html += `</div>`;

                if(data.evento === 'partido') html += `<div style="background: #ffebee; color: #c62828; font-size: 13px; padding: 10px; text-align: center; border-radius: 8px; border: 1px solid #ffcdd2; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">DÍA DE PARTIDO</div>`;
                else if(data.evento === 'descanso') html += `<div style="background: #e8f5e9; color: #2e7d32; font-size: 13px; padding: 10px; text-align: center; border-radius: 8px; border: 1px dashed #81c784; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">DESCANSO</div>`;
                else if(data.evento === 'desplazamiento') html += `<div style="background: #e3f2fd; color: #1565c0; font-size: 13px; padding: 10px; text-align: center; border-radius: 8px; border: 1px solid #90caf9; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">DESPLAZAMIENTO</div>`;

                if(data.contexto && (data.contexto.condicional || data.contexto.emocional)) {
                    html += `<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #ddd;">`;
                    if(data.contexto.condicional) html += `<div style="font-size: 11px; color: #e65100; background: #fff3e0; padding: 6px 8px; margin-bottom: 6px; border-radius: 6px; font-weight: 800;">COND: ${data.contexto.condicional}</div>`;
                    if(data.contexto.emocional) html += `<div style="font-size: 11px; color: #880e4f; background: #fce4ec; padding: 6px 8px; border-radius: 6px; font-weight: 800;">EMOC: ${data.contexto.emocional}</div>`;
                    html += `</div>`;
                }

                if(data.tareas && data.tareas.length > 0) {
                    data.tareas.forEach(t => {
                        let borderColor = "#555"; let bgColor = "#f5f5f5";
                        if(t.bloqueID === 'tecnica_defensiva') { borderColor = "#003366"; bgColor = "#e8f0fe"; }
                        if(t.bloqueID === 'tecnica_ofensiva') { borderColor = "#00acc1"; bgColor = "#e0f7fa"; }
                        if(t.bloqueID === 'tactica_defensiva') { borderColor = "#CB3524"; bgColor = "#ffebe9"; }
                        if(t.bloqueID === 'tactica_ofensiva') { borderColor = "#ff9800"; bgColor = "#fff3e0"; }

                        let cleanBloque = t.bloqueTexto.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ.\s]/g, '').trim();

                        html += `<div style="border-left: 5px solid ${borderColor}; background: ${bgColor}; padding: 10px; margin-bottom: 10px; border-radius: 0 8px 8px 0; border-top: 1px solid rgba(0,0,0,0.03); border-right: 1px solid rgba(0,0,0,0.03); border-bottom: 1px solid rgba(0,0,0,0.03);">
                                    <strong style="color: ${borderColor}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">${cleanBloque}</strong><br>
                                    <span style="font-weight: 900; color: #222; font-size: 12px; display: block; margin: 4px 0;">${t.gesto}</span>
                                    <div style="font-size: 10px; color: #555; display: flex; justify-content: space-between; font-weight: bold; align-items: center;">
                                        <span>${t.duracion}m | RPE ${t.rpe}</span>
                                        ${t.viaSalida ? `<span style="background: #fff; border: 1px solid #ddd; padding: 2px 5px; border-radius: 4px; color:#e65100;">Vía ${t.viaSalida}</span>` : ''}
                                    </div>
                                 </div>`;
                    });
                }
                
                html += `</div>`; 
            }
            html += `</div>`; 
            html += `</div>`; 
        }
        
        html += `</div>`;

        // Contenedor temporal: EL EXACTAMENTE MISMO MÉTODO QUE YA TE FUNCIONÓ
        const pdfContainer = document.createElement('div');
        pdfContainer.innerHTML = html;
        pdfContainer.style.position = 'absolute';
        pdfContainer.style.top = '-9999px'; // Oculto fuera de pantalla para que no moleste en tu UI
        pdfContainer.style.left = '-9999px';
        document.body.appendChild(pdfContainer);

        // CONFIGURACIÓN PREMIUM PARA PDF EXACTA A TU BACKUP
        const opciones = {
            margin:       0, 
            filename:     `Planificacion_Premium_ATM.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true
            }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // Generar tal cual el código V1.
        setTimeout(() => {
            html2pdf().set(opciones).from(pdfContainer).save().then(() => {
                document.body.removeChild(pdfContainer);
                mostrarAlerta("✅ Éxito", "El PDF se ha descargado correctamente.", false);
            }).catch(err => {
                console.error(err);
                if (document.body.contains(pdfContainer)) document.body.removeChild(pdfContainer);
                mostrarAlerta("❌ Error", "Fallo al generar el documento PDF.", true);
            });
        }, 1000); 
    });

    // 2. Exportar Gráficos
    document.getElementById('btn-export-dashboard').addEventListener('click', () => { 
        mostrarAlerta("⏳ Generando Informe", "Ajustando panel para exportación...", false);
        const contenedor = document.getElementById('pdf-dashboard');
        
        contenedor.classList.add('export-mode');

        const opciones = {
            margin:       10,
            filename:     `Auditoria_Graficos_ATM.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };

        html2pdf().set(opciones).from(contenedor).save().then(() => {
            contenedor.classList.remove('export-mode');
        });
    });

    // 3. Memoria Anual
    document.getElementById('btn-memoria-anual').addEventListener('click', () => {
        let stats = appDB.statsBloques; let totalTareas = stats.tecnica_defensiva + stats.tecnica_ofensiva + stats.tactica_defensiva + stats.tactica_ofensiva; if(totalTareas === 0) return alert("Sin datos");
        let tp = 0; let tr = 0; let avgQ = 0; let qCount = 0; let gestoMax = ""; let maxRep = 0; for (const [g, r] of Object.entries(appDB.statsGestos)) { if(r > maxRep) { maxRep = r; gestoMax = g; } }
        for (const [f, d] of Object.entries(appDB.fechas)) { if(d.tareas) d.tareas.forEach(t => { tp++; if(t.status === 'done') { tr++; if(t.gesto === gestoMax && t.calidad > 0) { avgQ += t.calidad; qCount++; } } }); }
        let e = tp > 0 ? ((tr/tp)*100).toFixed(1) : 0; let aS = [ { n: "Téc. Def", v: stats.tecnica_defensiva }, { n: "Téc. Ofe", v: stats.tecnica_ofensiva }, { n: "Tác. Def", v: stats.tactica_defensiva }, { n: "Tác. Ofe", v: stats.tactica_ofensiva } ].sort((a, b) => b.v - a.v); let qText = qCount > 0 ? ((avgQ/qCount) < 2 ? "BAJA" : "ALTA") : "Frecuente";
        let html = `<p><b>Total:</b> ${totalTareas} tareas. <b>Ejecución:</b> ${e}%.</p><br><p><b>Prioridad:</b> ${aS[0].n} (${aS[0].v} sesiones).</p><br><p>Gesto más usado: ${gestoMax} (${qText}).</p>`;
        document.getElementById('informe-fecha').innerText = `Fecha: ${new Date().toLocaleDateString('es-ES')}`; document.getElementById('informe-texto-ia').innerHTML = html; document.getElementById('informe-img-radar').src = document.getElementById('adnChart').toDataURL('image/png'); document.getElementById('informe-img-donut').src = document.getElementById('balanceChart').toDataURL('image/png');
        html2pdf().set({ margin: 0, filename: 'Memoria_ATM.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(document.getElementById('informe-oficial-template')).save();
    });

    // --- GENERADOR PPTX ---
    document.getElementById('btn-export-pptx').addEventListener('click', () => {
        let pptx = new PptxGenJS(); 
        pptx.layout = 'LAYOUT_16x9'; 
        
        let slide = pptx.addSlide(); 
        
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: "003366" });
        slide.addText("METODOLOGY ATM", { x: 0.5, y: 0.1, w: "40%", h: 0.4, fontSize: 18, bold: true, color: "FFFFFF", align: "left" });
        slide.addText("MEMORIA DE ENTRENAMIENTO", { x: 5.5, y: 0.1, w: "40%", h: 0.4, fontSize: 14, color: "FF9800", align: "right", italic: true });
        
        let tituloCiclo = document.getElementById('select-ciclo').options[document.getElementById('select-ciclo').selectedIndex].text;
        slide.addText(tituloCiclo.toUpperCase(), { x: 0.5, y: 0.9, w: "90%", h: 0.3, fontSize: 14, bold: true, color: "CB3524", align: "center" });

        let sData = [];
        document.querySelectorAll('.week-container').forEach((w, i) => {
            let sObj = { titulo: `MICRO ${i+1}`, tD: [], tO: [], taD: [], taO: [], c: [] };
            w.querySelectorAll('.day-card').forEach(d => { 
                let iso = d.id.replace('card-', ''); 
                if (appDB.fechas[iso]) { 
                    let data = appDB.fechas[iso]; 
                    if (data.contexto && data.contexto.condicional) sObj.c.push(data.contexto.condicional); 
                    if (data.tareas) data.tareas.forEach(t => { 
                        if(t.bloqueID === 'tecnica_defensiva') sObj.tD.push(t.gesto); 
                        if(t.bloqueID === 'tecnica_ofensiva') sObj.tO.push(t.gesto); 
                        if(t.bloqueID === 'tactica_defensiva') sObj.taD.push(t.gesto); 
                        if(t.bloqueID === 'tactica_ofensiva') sObj.taO.push(t.gesto); 
                    }); 
                } 
            });
            sObj.tD = [...new Set(sObj.tD)]; sObj.tO = [...new Set(sObj.tO)]; sObj.taD = [...new Set(sObj.taD)]; sObj.taO = [...new Set(sObj.taO)]; sObj.c = [...new Set(sObj.c)]; 
            sData.push(sObj);
        });

        let totalWidth = 9.0;
        let labelColWidth = 1.2;
        let weekColWidth = sData.length > 0 ? ((totalWidth - labelColWidth) / sData.length) : 0;
        let arrColW = [labelColWidth];
        sData.forEach(() => arrColW.push(weekColWidth));

        let rows = [];
        let headerRow = [{ text: "BLOQUE", options: { bold: true, fill: "003366", color: "FFFFFF", align: "center", valign: "middle", fontSize: 10 } }];
        sData.forEach(s => headerRow.push({ text: s.titulo, options: { bold: true, fill: "CB3524", color: "FFFFFF", align: "center", valign: "middle", fontSize: 10 } }));
        rows.push(headerRow);

        const cF = (tit, color, key) => { 
            let row = [{ text: tit, options: { bold: true, fill: color, color: "333333", align: "center", valign: "middle", fontSize: 9 } }]; 
            sData.forEach(s => { 
                row.push({ text: s[key].length>0 ? "• " + s[key].join("\n• ") : "-", options: { valign: "top", align: "left", fontSize: 8, color: "444444", margin: 0.05 } }); 
            }); 
            return row; 
        };
        
        rows.push(cF("Táct Def", "ffebe9", "taD")); 
        rows.push(cF("Téc Def", "e8f0fe", "tD")); 
        rows.push(cF("Táct Ofe", "fff3e0", "taO")); 
        rows.push(cF("Téc Ofe", "e0f7fa", "tO")); 
        rows.push(cF("Condic.", "f5f5f5", "c"));
        
        slide.addTable(rows, { x: 0.5, y: 1.3, w: totalWidth, colW: arrColW, border: { pt: 1, color: "CCCCCC" }, fill: "FFFFFF" }); 
        
        slide.addText("Generado por Metodology ATM", { x: 0.5, y: 5.3, w: "90%", h: 0.2, fontSize: 8, color: "888888", align: "center" });

        pptx.writeFile({ fileName: `Metodology_ATM_${tituloCiclo.replace(/\s/g, '_')}.pptx` });
    });

    // ==========================================
    // SISTEMA DE DESPLEGABLES PERSONALIZADOS
    // ==========================================
    function setupCustomSelects() {
        document.querySelectorAll('select.custom-select-auto').forEach(select => {
            if (select.dataset.customized) return;
            select.dataset.customized = true;

            select.style.display = 'none';

            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            select.parentNode.insertBefore(wrapper, select);
            wrapper.appendChild(select);

            const trigger = document.createElement('div');
            trigger.className = 'custom-select-trigger glass-input';
            const triggerText = document.createElement('span');
            triggerText.className = 'trigger-text';
            triggerText.textContent = select.options[select.selectedIndex]?.text || '';
            trigger.appendChild(triggerText);
            const arrow = document.createElement('span');
            arrow.textContent = '▼';
            arrow.className = 'trigger-arrow';
            trigger.appendChild(arrow);
            wrapper.appendChild(trigger);

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'custom-select-options';
            wrapper.appendChild(optionsContainer);

            const renderOptions = () => {
                optionsContainer.innerHTML = '';
                Array.from(select.options).forEach((option, index) => {
                    const optDiv = document.createElement('div');
                    optDiv.className = 'custom-option';
                    if (option.selected) optDiv.classList.add('selected');
                    if (option.disabled) optDiv.classList.add('disabled');
                    optDiv.textContent = option.text;

                    optDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (option.disabled) return;
                        
                        select.selectedIndex = index;
                        select.value = option.value; 
                        triggerText.textContent = option.text;
                        
                        wrapper.classList.remove('open');
                        select.dispatchEvent(new Event('change'));
                    });
                    optionsContainer.appendChild(optDiv);
                });
            };
            renderOptions();

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = wrapper.classList.contains('open');
                document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
                if (!isOpen && !select.disabled) wrapper.classList.add('open');
            });

            select.addEventListener('change', () => {
                triggerText.textContent = select.options[select.selectedIndex]?.text || '';
                Array.from(optionsContainer.children).forEach((optDiv, index) => {
                    optDiv.classList.toggle('selected', index === select.selectedIndex);
                });
            });

            const observer = new MutationObserver(() => {
                renderOptions();
                triggerText.textContent = select.options[select.selectedIndex]?.text || '';
                wrapper.classList.toggle('disabled-wrapper', select.disabled);
            });
            observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });
            
            wrapper.classList.toggle('disabled-wrapper', select.disabled);
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
        });
    }

    setupCustomSelects();

});

// --- RENDERIZADO DEL MACROCICLO GANTT ---
function renderMacrociclo() {
    const container = document.getElementById('gantt-container'); container.innerHTML = '';
    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let hoy = new Date(); let startYear = hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1; let sequence = [7,8,9,10,11,0,1,2,3,4,5]; 
    sequence.forEach(monthIndex => {
        let actualYear = monthIndex >= 7 ? startYear : startYear + 1; let primerDiaMes = new Date(actualYear, monthIndex, 1);
        let monthDiv = document.createElement('div'); monthDiv.className = 'gantt-month'; let htmlSemanas = `<div class="gantt-month-header">${mesesNombres[monthIndex]} ${actualYear}</div><div class="gantt-weeks">`;
        let currentLunes = getPrimerLunesMeso(primerDiaMes); let ultimoLunes = getUltimoLunesMeso(new Date(actualYear, monthIndex + 1, 0));
        let numSemanas = Math.round((ultimoLunes - currentLunes) / (7 * 24 * 60 * 60 * 1000)) + 1;
        for(let s = 0; s < numSemanas; s++) {
            let fechaSemana = new Date(currentLunes); fechaSemana.setDate(fechaSemana.getDate() + (s * 7)); let isoLunes = toLocalISO(fechaSemana);
            let claseFase = 'phase-comp'; if(monthIndex === 7) claseFase = 'phase-pre'; if(monthIndex === 11 && s > 2) claseFase = 'phase-break'; if(monthIndex === 5 && s > 1) claseFase = 'phase-break'; 
            let numTareas = 0; for(let i=0; i<7; i++) { let d = new Date(fechaSemana); d.setDate(d.getDate()+i); let iso = toLocalISO(d); if(appDB.fechas[iso] && appDB.fechas[iso].tareas) numTareas += appDB.fechas[iso].tareas.length; }
            let heightBar = numTareas === 0 ? 5 : Math.min(100, (numTareas * 10));
            htmlSemanas += `<div class="gantt-week ${claseFase}" title="Ver Microciclo"><div class="gantt-tooltip">Micro ${fechaSemana.getDate()}/${fechaSemana.getMonth()+1}<br>${numTareas} Tareas</div><div class="gantt-bar" style="height: ${heightBar}px;"></div></div>`;
        }
        htmlSemanas += `</div>`; monthDiv.innerHTML = htmlSemanas; container.appendChild(monthDiv);
    });
}

// FUNCIONES GLOBALES
function inicializarDragAndDrop() {
    document.querySelectorAll('.task-list').forEach(list => {
        new Sortable(list, { group: 'tareas-semanales', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
            onEnd: function (evt) {
                const fromDateStr = evt.from.id.replace('list-', ''); const toDateStr = evt.to.id.replace('list-', ''); const oldIndex = evt.oldIndex; const newIndex = evt.newIndex;
                if (fromDateStr === toDateStr && oldIndex === newIndex) return;
                const tareaMovida = appDB.fechas[fromDateStr].tareas.splice(oldIndex, 1)[0];
                if (!appDB.fechas[toDateStr]) { appDB.fechas[toDateStr] = { evento: "", contexto: { condicional: "", emocional: "", transversal: "" }, tareas: [] }; }
                let fechaDestinoObj = new Date(toDateStr + "T12:00:00"); fechaDestinoObj.setDate(fechaDestinoObj.getDate() + 1); let isMD1 = (appDB.fechas[toLocalISO(fechaDestinoObj)] && appDB.fechas[toLocalISO(fechaDestinoObj)].evento === 'partido');
                if (isMD1 && (tareaMovida.gesto.includes("1vs1") || tareaMovida.gesto.includes("Transición") || tareaMovida.gesto.includes("Contraataque"))) { appDB.fechas[fromDateStr].tareas.splice(oldIndex, 0, tareaMovida); setTimeout(() => location.reload(), 2500); alert(`🚨 ALERTA (MD-1)\nNo puedes mover "${tareaMovida.gesto}" a un día pre-partido.`); return; }
                appDB.fechas[toDateStr].tareas.splice(newIndex, 0, tareaMovida); window.guardarBaseDeDatos();
            }
        });
    });
}

let plantillasGuardadas = JSON.parse(localStorage.getItem('atleti_templates_team')) || {};
window.abrirModalPlantilla = function(isoLunes) { document.getElementById('template-iso-lunes').value = isoLunes; document.getElementById('input-template-name').value = ""; document.getElementById('template-modal').classList.remove('hidden'); };
window.cargarPlantillaPrompt = function(isoLunesDestino) { let nombres = Object.keys(plantillasGuardadas); if(nombres.length === 0) return alert("Sin plantillas."); let msj = "NÚMERO de plantilla:\n"; nombres.forEach((n, i) => msj += `${i+1}. ${n}\n`); let seleccion = prompt(msj); if(seleccion && !isNaN(seleccion) && seleccion > 0 && seleccion <= nombres.length) { let nombreElegido = nombres[seleccion-1]; let semanaData = plantillasGuardadas[nombreElegido]; let fecha = new Date(isoLunesDestino + "T12:00:00"); for(let i=0; i<7; i++) { let currentISO = toLocalISO(fecha); if(semanaData[i]) { appDB.fechas[currentISO] = JSON.parse(JSON.stringify(semanaData[i])); if(appDB.fechas[currentISO].tareas) { appDB.fechas[currentISO].tareas.forEach(t => { appDB.statsBloques[t.bloqueID] = (appDB.statsBloques[t.bloqueID] || 0) + 1; appDB.statsGestos[t.gesto] = (appDB.statsGestos[t.gesto] || 0) + 1; }); } } fecha.setDate(fecha.getDate() + 1); } window.guardarBaseDeDatos(); location.reload(); } };
document.getElementById('btn-confirm-save-template').addEventListener('click', () => { let isoLunes = document.getElementById('template-iso-lunes').value; let nombre = document.getElementById('input-template-name').value; if(!nombre) return alert("Ponle nombre"); let semanaData = []; let fecha = new Date(isoLunes + "T12:00:00"); for(let i=0; i<7; i++) { let currentISO = toLocalISO(fecha); semanaData.push(appDB.fechas[currentISO] ? JSON.parse(JSON.stringify(appDB.fechas[currentISO])) : null); fecha.setDate(fecha.getDate() + 1); } plantillasGuardadas[nombre] = semanaData; localStorage.setItem('atleti_templates_team', JSON.stringify(plantillasGuardadas)); document.getElementById('template-modal').classList.add('hidden'); alert("Guardada"); });