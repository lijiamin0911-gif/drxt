/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Key, Users, Shield, Plus, Trash2, MapPin, Download, Upload, X, ShieldAlert,
  Lock, Eye, EyeOff
} from 'lucide-react';
import { User } from '../types';

// ==========================================
// 1. LOGIN MODAL
// ==========================================
interface LoginModalProps {
  isOpen: boolean;
  onLogin: (u: string, p: string) => boolean;
  onResetUsers: () => void;
}

export function LoginModal({ isOpen, onLogin, onResetUsers }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('请输入用户名和密码');
      return;
    }
    const success = onLogin(username.trim(), password.trim());
    if (!success) {
      setErrorMsg('用户名或密码错误');
    } else {
      setErrorMsg('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Modal element */}
      <div 
        className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100"
        id="login-dialog"
      >
        <div className="p-8">
          {/* Logo Brand Header */}
          <div className="flex flex-col items-center justify-center mb-8 text-center">
            <div className="w-12 h-12 bg-[#1a5c9e]/10 text-[#1a5c9e] rounded-xl flex items-center justify-center mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">销售经营分析看板</h1>
            <p className="text-xs text-slate-400 mt-1">系统登录及多级权限控制</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                用户名
              </label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-700 text-sm focus:border-[#1a5c9e] focus:ring-2 focus:ring-[#1a5c9e]/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                密码
              </label>
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-700 text-sm focus:border-[#1a5c9e] focus:ring-2 focus:ring-[#1a5c9e]/15 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-xl border border-red-200/50 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full py-3 bg-[#1a5c9e] hover:bg-[#154678] text-white font-medium text-sm rounded-xl hover:shadow-lg hover:shadow-[#1a5c9e]/10 transition-all cursor-pointer mt-2"
            >
              登 录
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}


// ==========================================
// 2. USER MANAGEMENT MODAL (ADMIN ONLY)
// ==========================================
interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onAddUser: (username: string, role: 'boss' | 'region_manager', region: string, pass: string) => boolean;
  onDeleteUser: (username: string) => void;
  onResetPassword: (username: string, newPass: string) => void;
}

export function UserManagementModal({
  isOpen,
  onClose,
  users,
  onAddUser,
  onDeleteUser,
  onResetPassword
}: UserManagementModalProps) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'boss' | 'region_manager'>('region_manager');
  const [newRegion, setNewRegion] = useState('华中');

  // Inline state to track password reset trigger
  const [activeResetUser, setActiveResetUser] = useState<string | null>(null);
  const [resetPassInput, setResetPassInput] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      alert('请填入完整的用户名和密码');
      return;
    }
    const regionVal = newRole === 'region_manager' ? newRegion : '';
    const ok = onAddUser(newUsername.trim(), newRole, regionVal, newPassword.trim());
    if (ok) {
      setNewUsername('');
      setNewPassword('');
    }
  };

  const handleResetPassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResetUser || !resetPassInput.trim()) return;
    onResetPassword(activeResetUser, resetPassInput.trim());
    setActiveResetUser(null);
    setResetPassInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal element */}
      <div 
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[85vh]"
        id="user-management-dialog"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1a5c9e]" />
            <span className="font-bold text-slate-800 text-lg">系统用户管理</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section: Add User */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-600 mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              添加新系统账号
            </h4>
            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">用户名</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="用户名"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-700 focus:border-[#1a5c9e]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">登录密码</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="密码"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-700 focus:border-[#1a5c9e]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">分配角色</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'boss' | 'region_manager')}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-700 focus:border-[#1a5c9e]"
                >
                  <option value="region_manager">大区经理</option>
                  <option value="boss">老板 / 决策者</option>
                </select>
              </div>
              {newRole === 'region_manager' ? (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">分配大区</label>
                  <select 
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs text-slate-700 focus:border-[#1a5c9e]"
                  >
                    <option value="华北">华北大区</option>
                    <option value="华中">华中大区</option>
                    <option value="华东">华东大区</option>
                    <option value="华南">华南大区</option>
                  </select>
                </div>
              ) : (
                <div className="opacity-40">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">分配大区 (不限)</label>
                  <input
                    type="text"
                    disabled
                    value="全部区域"
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end mt-2">
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> 保存并添加
                </button>
              </div>
            </form>
          </div>

          {/* Section: User List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              系统用户账号清单
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full border-collapse text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">用户名</th>
                    <th className="p-3">角色权限</th>
                    <th className="p-3">管辖大区</th>
                    <th className="p-3 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.username} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{u.username}</td>
                      <td className="p-3">
                        {u.role === 'admin' ? (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-200/50">
                            系统管理员
                          </span>
                        ) : u.role === 'boss' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-semibold border border-indigo-200/50">
                            老板 (全局)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[10px] font-semibold border border-sky-200/50">
                            大区经理
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{u.region || '— (管辖全局)'}</td>
                      <td className="p-3 text-right flex items-center justify-end gap-1.5 h-11">
                        {/* Reset password button */}
                        <button 
                          onClick={() => {
                            setActiveResetUser(u.username);
                            setResetPassInput('');
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-[#1a5c9e]/10 text-slate-600 hover:text-[#1a5c9e] rounded transition-colors text-[10px] font-semibold cursor-pointer"
                        >
                          设置新密码
                        </button>
                        {u.username !== 'admin' ? (
                          <button 
                            onClick={() => {
                              if (confirm(`确定要彻底删除用户账号 [ ${u.username} ] 吗？该操作不可逆。`)) {
                                onDeleteUser(u.username);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                            title="删除用户"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="px-2 text-slate-300 pointer-events-none text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Floating Password Reset Prompt */}
        {activeResetUser && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-20">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-100">
              <h5 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
                <Lock className="w-4 h-4 text-[#1a5c9e]" />
                为 [{activeResetUser}] 重置新密码
              </h5>
              <p className="text-xs text-slate-400 mb-4">无需原密码验证，管理员可直接修改该成员登录凭证。</p>
              
              <form onSubmit={handleResetPassSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="请输入新密码"
                  value={resetPassInput}
                  onChange={(e) => setResetPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs focus:border-[#1a5c9e]"
                />
                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveResetUser(null);
                      setResetPassInput('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#1a5c9e] hover:bg-[#154678] text-white rounded-lg font-semibold transition-colors cursor-pointer animate-pulse-once"
                  >
                    确认重置
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ==========================================
// 3. CHANGE PASSWORD MODAL (SELF)
// ==========================================
interface ChangePwdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onConfirmChange: (oldPass: string, newPass: string) => boolean;
}

export function ChangePwdModal({ isOpen, onClose, currentUser, onConfirmChange }: ChangePwdModalProps) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmNew) {
      setErrorMsg('请填写所有输入框');
      return;
    }
    if (newPass !== confirmNew) {
      setErrorMsg('两次输入的新密码不一致');
      return;
    }
    if (newPass.length < 3) {
      setErrorMsg('为了您的账户安全，密码长度不能少于3位');
      return;
    }

    const ok = onConfirmChange(oldPass, newPass);
    if (ok) {
      setErrorMsg('');
      setOldPass('');
      setNewPass('');
      setConfirmNew('');
      onClose();
    } else {
      setErrorMsg('当前旧密码验证失败，请重新输入');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal element */}
      <div 
        className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100"
        id="change-pwd-dialog"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4.5 h-4.5 text-zinc-600" />
            <span className="font-bold text-slate-800 text-sm">修改个人登录密码</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              当前密码
            </label>
            <input 
              type="password"
              required
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              placeholder="请输入您目前的登录密码" 
              className="w-full px-3 py-2 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              新密码
            </label>
            <input 
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="请输入要设置的新密码" 
              className="w-full px-3 py-2 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              重复确认新密码
            </label>
            <input 
              type="password"
              required
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              placeholder="请再次键入您的新密码" 
              className="w-full px-3 py-2 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="text-red-600 text-xs font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200/40">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#1a5c9e] hover:bg-[#154678] text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              确认保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ==========================================
// 4. REGION MAPPING MODAL
// ==========================================
interface RegionMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionStoreMap: Record<string, string[]>;
  onSaveMappings: (newMap: Record<string, string[]>) => void;
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export function RegionMappingModal({
  isOpen,
  onClose,
  regionStoreMap,
  onSaveMappings,
  onShowToast
}: RegionMappingModalProps) {
  // Convert standard record map to a flat row array: { id, region, store }
  const getInitialMappedRows = () => {
    const rows: { id: number; region: string; store: string }[] = [];
    let counter = 1;
    Object.entries(regionStoreMap).forEach(([region, stores]) => {
      stores.forEach(store => {
        rows.push({ id: counter++, region, store });
      });
    });
    return rows;
  };

  const [rows, setRows] = useState(() => getInitialMappedRows());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddRow = () => {
    const maxId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) : 0;
    setRows([...rows, { id: maxId + 1, region: '', store: '' }]);
  };

  const handleDeleteRow = (id: number) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleChangeRow = (id: number, field: 'region' | 'store', val: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleSave = () => {
    // Validate rows
    const cleanedRows = rows.filter(r => r.region.trim() && r.store.trim());
    if (cleanedRows.length === 0) {
      alert('请添加至少一条包含有效区域和分店名称的非空数据！');
      return;
    }

    // Convert rows back to Record<string, string[]>
    const finalMap: Record<string, string[]> = {};
    cleanedRows.forEach(r => {
      const regObj = r.region.trim();
      const stObj = r.store.trim();
      if (!finalMap[regObj]) {
        finalMap[regObj] = [];
      }
      if (!finalMap[regObj].includes(stObj)) {
        finalMap[regObj].push(stObj);
      }
    });

    onSaveMappings(finalMap);
    onShowToast('✅ 区域与分店映射关系保存成功', 'success');
    onClose();
  };

  // Download template
  const handleDownloadTemplate = () => {
    const headers = ['区域', '分店'];
    const sampleData = [
      ['华中', '黄石店'],
      ['华中', '武汉店'],
      ['华中', '长沙店'],
      ['华北', '北京店'],
      ['华北', '天津店'],
      ['华东', '上海店'],
      ['华东', '南京店'],
      ['华东', '杭州店'],
      ['华南', '广州店'],
      ['华南', '深圳店']
    ];
    const wsData = [headers, ...sampleData];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '区域-分店对照表');
    XLSX.writeFile(wb, '区域分店映射导入模版.xlsx');
    onShowToast('模版下载成功', 'success');
  };

  // Upload mapping XLS
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const u8Data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(u8Data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        if (jsonData.length === 0) {
          onShowToast('上传的Excel没有发现有效的数据行', 'error');
          return;
        }

        // Detect column headings
        const sampleRow = jsonData[0];
        const keys = Object.keys(sampleRow);
        const regHead = keys.find(k => k.includes('区域') || k.toLowerCase().includes('region'));
        const stHead = keys.find(k => k.includes('分店') || k.toLowerCase().includes('store') || k.includes('门店'));

        if (!regHead || !stHead) {
          onShowToast('Excel必须包含“区域”和“分店”两列！请使用下载的系统模版。', 'error');
          return;
        }

        const uploadedRows: { id: number; region: string; store: string }[] = [];
        let i = 1;

        jsonData.forEach(item => {
          const rValue = String(item[regHead] || '').trim();
          const sValue = String(item[stHead] || '').trim();
          if (rValue && sValue) {
            uploadedRows.push({
              id: i++,
              region: rValue,
              store: sValue
            });
          }
        });

        if (uploadedRows.length === 0) {
          onShowToast('未能从Excel表格解析出任何有效的区域商铺对照对。', 'error');
          return;
        }

        setRows(uploadedRows);
        onShowToast(`已成功载入 ${uploadedRows.length} 条关系，请点击“保存映射”使之生效。`, 'success');
      } catch (err: any) {
        onShowToast('Excel文件解析失败：' + err.message, 'error');
      }
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal element */}
      <div 
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[80vh]"
        id="region-mapping-dialog"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4.5 h-4.5 text-[#1a5c9e]" />
            <span className="font-bold text-slate-800 text-sm">区域与分店关系管理</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content scrollable body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-400 max-w-[280px]">
              本系统的数据根据映射表将“分店(分公司)”划归大区并做相应的销售与库存权限隔离过滤。
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDownloadTemplate}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#1a5c9e] hover:bg-[#1a5c9e]/10 border border-[#1a5c9e]/20 hover:border-[#1a5c9e]/40 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> 模版下载
              </button>
              <button
                onClick={handleUploadClick}
                className="px-2.5 py-1.5 text-xs font-semibold bg-[#1a5c9e] hover:bg-[#154678] text-white rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> 批量上传
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadFile}
                accept=".xlsx, .xls"
                className="hidden"
              />
            </div>
          </div>

          {/* Dynamic grid Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                  <tr>
                    <th className="p-3">大区名称 (区域)</th>
                    <th className="p-3">分店/商铺</th>
                    <th className="p-3 text-center w-14">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400">
                        目前没有任何对照，请添加行或上传Excel。
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, index) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <input 
                            type="text"
                            required
                            placeholder="如：华中"
                            value={r.region}
                            onChange={(e) => handleChangeRow(r.id, 'region', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 outline-none text-xs rounded-md focus:border-[#1a5c9e] text-slate-700"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            required
                            placeholder="如：黄石店"
                            value={r.store}
                            onChange={(e) => handleChangeRow(r.id, 'store', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 outline-none text-xs rounded-md focus:border-[#1a5c9e] text-slate-700"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteRow(r.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="删除此行"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            新增映射行
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-[#1a5c9e] hover:bg-[#154678] text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-[#1a5c9e]/15 transition-all cursor-pointer"
            >
              保存映射
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
