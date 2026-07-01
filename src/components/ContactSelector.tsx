import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Chat } from '../types';
import { Search, X, User, Phone, Text, Info, Plus, ArrowLeft, CheckCircle2, AlertCircle, Users, Check, Scan, Trash2 } from 'lucide-react';
import CountryCodePicker from './CountryCodePicker';
import { api } from '../services/api';

interface ContactSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
  onAddCustomContact: (contact: { name: string; phone: string; username: string; bio: string; userId: string }) => void;
  onCreateGroup: () => void;
  userId: string | null;
  onScanQr: () => void;
}

export default function ContactSelector({
  isOpen, onClose, onSelectContact, onAddCustomContact, onCreateGroup, userId, onScanQr
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNewContact, setShowAddNewContact] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [savedContacts, setSavedContacts] = useState<Chat[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('+58');
  const [cPhone, setCPhone] = useState('');
  const [cUsername, setCUsername] = useState('');
  const [cBio, setCBio] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchPhoneQuery, setSearchPhoneQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [detectedUser, setDetectedUser] = useState<any>(null);
  const [swipedContactId, setSwipedContactId] = useState<string | null>(null);

  const handleDeleteContact = async (contact: Chat) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este contacto?')) return;
    try {
      await api.deleteContact(contact.id);
      setSavedContacts(prev => prev.filter(c => c.id !== contact.id));
      setSwipedContactId(null);
    } catch {
      setSwipedContactId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoadingContacts(true);
    setSwipedContactId(null);
    api.getContacts().then(list => {
      setSavedContacts(list);
    }).catch(() => {}).finally(() => setLoadingContacts(false));
  }, [isOpen]);

  useEffect(() => {
    setSwipedContactId(null);
  }, [searchQuery]);

  if (!isOpen) return null;

  const filteredSavedContacts = savedContacts.filter(c => {
    const term = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.username.toLowerCase().includes(term) || c.phone.includes(term);
  });

  const getInitials = (name: string) => name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const handleSelectSavedContact = async (contact: Chat) => {
    onAddCustomContact({
      name: contact.name,
      phone: contact.phone,
      username: contact.username,
      bio: contact.bio,
      userId: contact.id,
    });
  };

  const handlePhoneChange = async (phone: string) => {
    setCPhone(phone);
    setErrorMsg('');
    setDetectedUser(null);
    if (phone.length >= 7) {
      setSearchingUser(true);
      try {
        const users = await api.searchUsers(phone);
        const phoneDigits = phone.replace(/\D/g, '');
        const match = users.find((u: any) => (u.phone || '').replace(/\D/g, '').includes(phoneDigits));
        if (match) {
          setDetectedUser(match);
          setCName(match.name);
          setCUsername(match.username.replace('@', ''));
          setCBio('Usuario RED ON');
        }
      } catch {}
      setSearchingUser(false);
    }
  };

  const handleAddNewContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!cName.trim()) { setErrorMsg('El nombre es obligatorio.'); return; }
    if (!cPhone.trim()) { setErrorMsg('El número de teléfono es obligatorio.'); return; }

    setAdding(true);
    try {
      const res = await api.addContact(cPhone, cName);
      const contact = res.contact;
      onAddCustomContact({
        name: cName,
        phone: `${cCode} ${cPhone}`,
        username: contact.username,
        bio: cBio || 'Usuario RED ON',
        userId: contact.id
      });
    } catch (err: any) {
      if (err.message.includes('No se encontró')) {
        // Contact is not on RED ON - still add them locally
        onAddCustomContact({
          name: cName,
          phone: `${cCode} ${cPhone}`,
          username: cUsername ? `@${cUsername}` : '@contacto',
          bio: cBio || 'Contacto externo'
        });
      } else {
        setErrorMsg(err.message);
        setAdding(false);
        return;
      }
    }
    setCName(''); setCCode('+58'); setCPhone(''); setCUsername(''); setCBio(''); setErrorMsg('');
    setShowAddNewContact(false);
    setAdding(false);
  };

  return (
    <div className="absolute inset-0 bg-[#f0f2f5] z-50 flex flex-col anim-slide-up-full overflow-hidden font-sans">
      <header className="bg-white px-5 py-4 flex items-center justify-between border-b border-slate-100 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button onClick={showCreateGroup ? () => setShowCreateGroup(false) : showAddNewContact ? () => setShowAddNewContact(false) : onClose}
            className="p-1.5 -ml-1 rounded-full text-slate-500 hover:bg-slate-150 transition-colors cursor-pointer" title="Volver">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-slate-900 font-bold text-base leading-none">
              {showCreateGroup ? 'Nuevo Grupo' : showAddNewContact ? 'Nuevo Contacto' : 'Nuevo Chat'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-tight">
              {showCreateGroup ? 'Selecciona participantes' : showAddNewContact ? 'Añade por número de teléfono' : 'Elige un contacto'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full cursor-pointer transition-colors" title="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showCreateGroup ? (
          <>
            <div className="max-w-md mx-auto">
              <input type="text" placeholder="Nombre del grupo" value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-slate-800 placeholder-slate-450 shadow-sm mb-4" />
              {savedContacts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium">No tienes contactos guardados</p>
                  <p className="text-[10px] mt-1">Guarda contactos primero para crear un grupo</p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider px-1 mb-2">
                    Seleccionados: {selectedGroupMembers.size}
                  </p>
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs divide-y divide-slate-50 max-h-[55vh] overflow-y-auto">
                    {savedContacts.map((contact) => (
                      <div key={contact.id}
                        onClick={() => {
                          const next = new Set(selectedGroupMembers);
                          if (next.has(contact.id)) next.delete(contact.id);
                          else next.add(contact.id);
                          setSelectedGroupMembers(next);
                        }}
                        className="px-4 py-3.5 flex items-center gap-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${selectedGroupMembers.has(contact.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                          {selectedGroupMembers.has(contact.id) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="relative flex-shrink-0">
                          {contact.avatar ? (
                            <img src={contact.avatar} alt={contact.name} className="w-11 h-11 rounded-full object-cover border border-slate-50 shadow-xs" />
                          ) : (
                            <div className={`w-11 h-11 rounded-full ${contact.avatarColor || 'bg-slate-450'} text-white font-bold text-xs flex items-center justify-center border border-white shadow-xs`}>
                              {getInitials(contact.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-slate-900 font-bold text-sm tracking-tight leading-tight truncate">{contact.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">{contact.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    if (!groupName.trim()) { setErrorMsg('Escribe un nombre para el grupo'); return; }
                    if (selectedGroupMembers.size < 1) { setErrorMsg('Selecciona al menos un participante'); return; }
                    setCreatingGroup(true);
                    onCreateGroup?.(groupName.trim(), [...selectedGroupMembers]);
                  }} disabled={creatingGroup || selectedGroupMembers.size < 1}
                    className="w-full mt-4 py-3 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-2 disabled:opacity-50">
                    {creatingGroup ? 'Creando...' : `Crear grupo (${selectedGroupMembers.size} participantes)`}
                  </button>
                  {errorMsg && (
                    <p className="text-[10px] text-red-500 mt-2 text-center">{errorMsg}</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : !showAddNewContact ? (
          <>
            <div className="max-w-md mx-auto relative select-none">
              <span className="absolute left-4 top-3.5 text-slate-400"><Search className="w-4 h-4" /></span>
              <input type="text" placeholder="Buscar por nombre, usuario o teléfono..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-10 py-3 text-sm focus:outline-none focus:border-[#3390ec]/50 transition-all text-slate-800 placeholder-slate-450 shadow-sm" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="max-w-md mx-auto space-y-2 pb-16">
              {/* Nuevo Grupo */}
              <div onClick={() => setShowCreateGroup(true)}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="px-4 py-3.5 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-slate-900 font-bold text-sm tracking-tight leading-tight">Nuevo Grupo</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Crea un grupo con varios contactos</p>
                  </div>
                </div>
              </div>

              {/* Contactos guardados */}
              {filteredSavedContacts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between pb-1 select-none mt-4">
                    <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider px-1">Contactos guardados ({filteredSavedContacts.length})</span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs divide-y divide-slate-50">
                    {filteredSavedContacts.map((contact) => (
                      <div key={contact.id} className="relative overflow-hidden">
                        <div className="absolute inset-y-0 right-0 w-[72px] bg-red-500 flex items-center justify-center rounded-r-xl">
                          <button onClick={() => handleDeleteContact(contact)}
                            className="w-full h-full flex items-center justify-center text-white cursor-pointer active:bg-red-600 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: -72, right: 0 }}
                          dragElastic={0.1}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -36) setSwipedContactId(contact.id);
                            else setSwipedContactId(null);
                          }}
                          animate={{ x: swipedContactId === contact.id ? -72 : 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          onClick={() => handleSelectSavedContact(contact)}
                          className="px-4 py-3.5 flex items-center gap-3.5 hover:bg-slate-50 cursor-pointer transition-colors group bg-white relative"
                          style={{ touchAction: 'pan-y' }}>
                          <div className="relative flex-shrink-0 select-none">
                            {contact.avatar ? (
                              <img src={contact.avatar} alt={contact.name} className="w-11 h-11 rounded-full object-cover border border-slate-50 shadow-xs" />
                            ) : (
                              <div className={`w-11 h-11 rounded-full ${contact.avatarColor || 'bg-slate-450'} text-white font-bold text-xs flex items-center justify-center border border-white shadow-xs`}>
                                {getInitials(contact.name)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-slate-900 font-bold text-sm tracking-tight leading-tight group-hover:text-[#3390ec] transition-colors truncate">{contact.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5 select-none">
                              <span className="text-[10px] text-slate-400 truncate leading-none">{contact.phone}</span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredSavedContacts.length === 0 && !loadingContacts && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm font-medium">No hay contactos guardados</p>
                  <p className="text-xs mt-1">Usa "Añadir por teléfono" para agregar contactos</p>
                </div>
              )}

              {/* Añadir por teléfono */}
              <div className="pt-2">
                <button onClick={() => setShowAddNewContact(true)}
                  className="w-full py-3 text-xs font-bold text-white bg-[#3390ec] hover:bg-[#2b7bc9] rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /><span>Añadir por teléfono</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <h4 className="text-slate-800 font-bold text-sm mb-1.5">Añadir por número de teléfono</h4>
            <p className="text-[11px] text-slate-400 mb-4 leading-normal">Ingresa el número y si ya usa RED ON se rellenarán sus datos automáticamente.</p>
            {onScanQr && (
              <button type="button" onClick={onScanQr}
                className="w-full mb-4 py-3 px-4 text-xs font-bold text-[#3390ec] bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 border border-dashed border-[#3390ec]/30">
                <Scan className="w-4 h-4" /><span>Escanear código QR</span>
              </button>
            )}
            <form onSubmit={handleAddNewContactSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{errorMsg}
                </div>
              )}
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Número de Teléfono*</label>
                <div className="flex gap-2 items-start">
                  <CountryCodePicker value={cCode} onChange={setCCode} />
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input type="tel" placeholder="412 123 4567" value={cPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3390ec]" required autoFocus />
                  </div>
                </div>
                {searchingUser && <p className="text-xs text-slate-400 mt-1">Buscando usuario...</p>}
                {detectedUser && (
                  <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>¡Este número ya usa RED ON! Los datos se rellenaron automáticamente.</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Nombre Completo*</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Ej. Manuel Torres" value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3390ec]" required />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Usuario (opcional)</label>
                <input type="text" placeholder="@manuel_t" value={cUsername}
                  onChange={(e) => setCUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3390ec]" />
              </div>
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block mb-1">Nota (opcional)</label>
                <div className="relative">
                  <Text className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Ej. Hamburguesas El Chamo..." value={cBio}
                    onChange={(e) => setCBio(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3390ec]" />
                </div>
              </div>
              <div className="p-3 bg-blue-50 text-slate-600 text-[10px] rounded-xl flex gap-2 select-none leading-relaxed">
                <Info className="w-4 h-4 text-[#3390ec] flex-shrink-0 mt-0.5" />
                <span>Si el número está registrado en RED ON, se vinculará automáticamente su usuario.</span>
              </div>
              <div className="flex gap-2 pt-1.5">
                <button type="button" onClick={() => { setShowAddNewContact(false); setCName(''); setCPhone(''); setCUsername(''); setCBio(''); setErrorMsg(''); setDetectedUser(null); }}
                  className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer text-center">Cancelar</button>
                <button type="submit" disabled={adding}
                  className="flex-1 py-3 text-xs font-bold text-white bg-[#3390ec] hover:bg-[#2b7bc9] rounded-xl transition-all cursor-pointer shadow-sm text-center disabled:opacity-50">
                  {adding ? 'Agregando...' : 'Guardar contacto'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
