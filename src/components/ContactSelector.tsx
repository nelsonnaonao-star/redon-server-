import React, { useState } from 'react';
import { Chat } from '../types';
import { Search, X, User, Phone, Text, Info, Plus, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import CountryCodePicker from './CountryCodePicker';
import { api } from '../services/api';

interface ContactSelectorProps {
  contacts: Chat[];
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
  onAddCustomContact: (newContact: { name: string; username: string; phone: string; bio: string; userId?: string }) => void;
}

export default function ContactSelector({
  contacts, isOpen, onClose, onSelectContact, onAddCustomContact
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNewContact, setShowAddNewContact] = useState(false);

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

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(c => {
    const term = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.username.toLowerCase().includes(term) || c.phone.includes(term);
  });

  const getInitials = (name: string) => name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const handlePhoneChange = async (phone: string) => {
    setCPhone(phone);
    setErrorMsg('');
    setDetectedUser(null);
    if (phone.length >= 7) {
      setSearchingUser(true);
      try {
        const users = await api.searchUsers(phone);
        const match = users.find((u: any) => u.phone.replace(/[\s+]/g, '').includes(phone.replace(/[\s+]/g, '')));
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
          <button onClick={showAddNewContact ? () => setShowAddNewContact(false) : onClose}
            className="p-1.5 -ml-1 rounded-full text-slate-500 hover:bg-slate-150 transition-colors cursor-pointer" title="Volver">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-slate-900 font-bold text-base leading-none">{showAddNewContact ? 'Nuevo Contacto' : 'Nuevo Chat'}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-tight">{showAddNewContact ? 'Añade por número de teléfono' : 'Elige un contacto'}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full cursor-pointer transition-colors" title="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!showAddNewContact && filteredContacts.length > 0 ? (
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
              <div className="flex items-center justify-between pb-1 select-none">
                <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider px-1">Contactos ({filteredContacts.length})</span>
                <button onClick={() => setShowAddNewContact(true)}
                  className="text-xs font-bold text-[#3390ec] hover:text-[#2b7bc9] flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /><span>Añadir por teléfono</span>
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs divide-y divide-slate-50">
                {filteredContacts.map((contact) => (
                  <div key={contact.id} onClick={() => onSelectContact(contact.id)}
                    className="px-4 py-3.5 flex items-center gap-3.5 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className="relative flex-shrink-0 select-none">
                      {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} className="w-11 h-11 rounded-full object-cover border border-slate-50 shadow-xs" />
                      ) : (
                        <div className={`w-11 h-11 rounded-full ${contact.avatarColor || 'bg-slate-450'} text-white font-bold text-xs flex items-center justify-center border border-white shadow-xs`}>
                          {getInitials(contact.name)}
                        </div>
                      )}
                      {contact.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-900 font-bold text-sm tracking-tight leading-tight group-hover:text-[#3390ec] transition-colors truncate">{contact.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 select-none">
                        <span className="text-[10px] text-slate-400 truncate leading-none">{contact.phone}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className={`text-[9px] font-bold tracking-tight uppercase leading-none ${contact.isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {contact.isOnline ? 'En línea' : 'Desconectado'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <h4 className="text-slate-800 font-bold text-sm mb-1.5">Añadir por número de teléfono</h4>
            <p className="text-[11px] text-slate-400 mb-4 leading-normal">Ingresa el número y si ya usa RED ON se rellenarán sus datos automáticamente.</p>
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
