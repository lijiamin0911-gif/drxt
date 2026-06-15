import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Trash2, 
  UserCheck, 
  UserX, 
  Key, 
  Building, 
  Lock,
  User as UserIcon,
  Search,
  Edit,
  Truck,
  Plus,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { User, Role, Supplier } from '../types';
import { DbService } from '../lib/dbService';

interface UserManagementViewProps {
  users: User[];
  onSaveUser: (user: User) => Promise<void>;
  onDeleteUser: (userId: string, username: string) => Promise<void>;
  currentUser: any;
}

export default function UserManagementView({ users, onSaveUser, onDeleteUser, currentUser }: UserManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'suppliers'>('users');
  
  // Suppliers management state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierMerchandiser, setSupplierMerchandiser] = useState('');
  const [supplierLeadTime, setSupplierLeadTime] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  const loadSuppliersList = () => {
    DbService.getSuppliers().then(sups => {
      setSuppliers(sups);
    });
  };

  useEffect(() => {
    loadSuppliersList();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('branch');
  const [branchName, setBranchName] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<Role>('branch');
  const [editBranchName, setEditBranchName] = useState('');
  const [editPin, setEditPin] = useState('');

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editUsername.trim() || !editPin.trim()) {
      alert('请完整填写账户名称与登录 PIN 码');
      return;
    }

    if (editRole === 'branch' && !editBranchName.trim()) {
      alert('分店账号必须填写关联分店名称');
      return;
    }

    // Check duplicate username if changed
    if (editUsername.trim().toLowerCase() !== editingUser.username.toLowerCase()) {
      const exists = users.find(u => u.username.toLowerCase() === editUsername.trim().toLowerCase() && u.id !== editingUser.id);
      if (exists) {
        alert('已存在同名账户，请更换后重试');
        return;
      }
    }

    setIsSubmitting(true);
    const updatedUser: User = {
      ...editingUser,
      username: editUsername.trim(),
      role: editRole,
      pin: editPin.trim(),
    };

    if (editRole === 'branch') {
      updatedUser.branchName = editBranchName.trim();
    } else {
      delete updatedUser.branchName;
    }

    try {
      await onSaveUser(updatedUser);
      setEditingUser(null);
      alert(`账户 [${updatedUser.username}] 的信息与登录密码更改成功！`);
    } catch (err) {
      console.error(err);
      alert('保存失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      alert('请完整填写账户名称与登录 PIN 码');
      return;
    }

    if (role === 'branch' && !branchName.trim()) {
      alert('分店账号必须填写关联分店名称');
      return;
    }

    // Check duplicate
    const exists = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      alert('已存在同名账户，请更换后重试');
      return;
    }

    setIsSubmitting(true);
    const newUser: User = {
      id: 'u_' + Date.now() + Math.random().toString(36).substring(2, 6),
      username: username.trim(),
      role,
      pin: pin.trim(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    if (role === 'branch') {
      newUser.branchName = branchName.trim();
    }

    try {
      await onSaveUser(newUser);
      // Reset
      setUsername('');
      setBranchName('');
      setPin('');
      setRole('branch');
      alert(`账户 [${newUser.username}] 创建成功！`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser.id) {
      alert('无法禁用或启用您当前登录的账户');
      return;
    }

    const updatedUser: User = {
      ...user,
      isActive: !user.isActive
    };

    try {
      await onSaveUser(updatedUser);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser.id) {
      alert('无法删除当前您登录的账户');
      return;
    }

    if (confirm(`确定要彻底删除账户 [${user.username}] 吗？删除后此账户无法登录，其历史记录将作为归档保留。`)) {
      try {
        await onDeleteUser(user.id, user.username);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert('请填写公司/供应商名称');
      return;
    }

    setIsSubmittingSupplier(true);
    const updatedModel: Supplier = {
      id: editingSupplier ? editingSupplier.id : ('sup_' + Date.now() + Math.random().toString(36).substring(2, 6)),
      name: supplierName.trim(),
      contact: supplierContact.trim(),
      phone: supplierPhone.trim(),
      isActive: editingSupplier ? editingSupplier.isActive : true,
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      merchandiserName: supplierMerchandiser.trim() || undefined,
      leadTimeText: supplierLeadTime.trim() || undefined
    };

    try {
      await DbService.saveSupplier(updatedModel, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      // clear
      setSupplierName('');
      setSupplierContact('');
      setSupplierPhone('');
      setSupplierMerchandiser('');
      setSupplierLeadTime('');
      setEditingSupplier(null);
      loadSuppliersList();
      alert(`供应商 [${updatedModel.name}] 保存成功！`);
    } catch (err) {
      console.error(err);
      alert('保存供应商异常，请重试');
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (confirm(`确定要彻底删除合作厂商 [${sup.name}] 吗？此操作不可逆。`)) {
      try {
        await DbService.deleteSupplier(sup.id, sup.name, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
        loadSuppliersList();
        alert('该供应商已被成功删除。');
      } catch (err) {
        console.error(err);
        alert('删除失败，请稍后重试');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.branchName && u.branchName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleBadge = (user: User) => {
    switch (user.role) {
      case 'admin':
        const isVice = user.username.includes('副') || user.username.toLowerCase().includes('vice') || user.username.toLowerCase().includes('sub');
        return (
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
            isVice 
              ? 'bg-amber-50 text-amber-700 border-amber-100' 
              : 'bg-rose-50 text-rose-700 border-rose-100'
          }`}>
            {isVice ? '副管理员' : '系统管理员(总)'}
          </span>
        );
      case 'branch':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-100">分店账户</span>;
      case 'receptionist':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">前台汇总</span>;
      case 'purchasing':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-750 text-indigo-700 border border-indigo-100">采购主管</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'users' 
              ? 'border-blue-600 text-blue-600 mb-[-2px]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          👤 成员账号管理与安全
        </button>
        <button
          onClick={() => {
            setActiveSubTab('suppliers');
            loadSuppliersList();
          }}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'suppliers' 
              ? 'border-blue-600 text-blue-600 mb-[-2px]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🏭 供应商与跟单分配 (各采购员绑定专属厂家/交期)
        </button>
      </div>

      {activeSubTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create / Edit form */}
          <div className={`rounded-xl border shadow-sm p-4 md:p-6 h-fit space-y-4 ${editingUser ? 'bg-amber-50/10 border-amber-200 animate-fadeIn' : 'bg-white border-slate-100'}`}>
            {editingUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600">
                  <Edit className="w-5 h-5 animate-pulse" />
                  <h3 className="font-semibold text-slate-800 text-sm md:text-base">修改账户与密码</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)} 
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                >
                  取消编辑
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-blue-600">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">新建系统账户</h3>
              </div>
            )}
            
            {editingUser ? (
              <form onSubmit={handleUpdateUser} className="space-y-4 pt-2 border-t border-amber-100">
                <div className="p-2.5 bg-amber-50 rounded-lg text-amber-800 text-xs flex flex-col gap-0.5 leading-relaxed">
                  <span className="font-bold">⚠️ 人员密码/信息变更：</span>
                  <span>管理员可以直接查看或直接在此重设该成员的登录密码 PIN 码。</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">账户名称 / 姓名</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="例如：城东分店 / 采购员"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-850 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">系统身份 / 角色权限</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as Role)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold"
                  >
                    <option value="branch">分店账号 (只能提交及查看本店订单)</option>
                    <option value="receptionist">前台账号 (核对并一键批量确认订单)</option>
                    <option value="purchasing">采购账号 (合并采购单、厂家发货跟踪)</option>
                    <option value="admin">系统管理员 - 总/副 (最高账号管理、报警线及查看日志)</option>
                  </select>
                </div>

                {editRole === 'branch' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="block text-xs font-medium text-slate-700">关联分店名称</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="例如：城东分店"
                        value={editBranchName}
                        onChange={e => setEditBranchName(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-850 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">账户登录 PIN 密码（可查看/直改）</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="登录用 PIN 密码"
                      value={editPin}
                      onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3 py-1.5 border border-amber-200 bg-amber-50/15 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-widest text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1 font-sans">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer text-center duration-150"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:bg-slate-350 duration-150"
                  >
                    {isSubmitting ? '保存中...' : '保存更改'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4 pt-2 border-t border-slate-50">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">账户名称 / 姓名</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="例如：城南分店 / 采购小张"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">系统身份 / 角色权限</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as Role)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                  >
                    <option value="branch">分店账号 (只能提交及查看本店订单)</option>
                    <option value="receptionist">前台账号 (核对并一键批量确认订单)</option>
                    <option value="purchasing">采购账号 (合并采购单、厂家发货跟踪)</option>
                    <option value="admin">系统管理员 - 总/副 (最高账号管理、报警线及查看日志)</option>
                  </select>
                </div>

                {role === 'branch' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="block text-xs font-medium text-slate-700">关联分店名称</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="例如：城东分店"
                        value={branchName}
                        onChange={e => setBranchName(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">登录安全 PIN 码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="4-8 位登录用数字 PIN"
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono tracking-widest"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-blue-400 mt-2"
                >
                  {isSubmitting ? '正在提交...' : '确认并创建账号'}
                </button>
              </form>
            )}
          </div>

          {/* Accounts List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">全系统账户名单 ({filteredUsers.length})</h3>
              </div>
              
              {/* Search bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索账户、角色或分店..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Table representation */}
            <div className="overflow-x-auto border border-slate-50 rounded-lg">
              <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="p-3 font-semibold text-slate-700 w-1/4">账户名称</th>
                    <th className="p-3 font-semibold text-slate-700 w-1/5">权限角色</th>
                    <th className="p-3 font-semibold text-slate-700 w-1/4">分店信息</th>
                    <th className="p-3 font-semibold text-slate-700 w-1/6">安全PIN码</th>
                    <th className="p-3 font-semibold text-slate-700 w-1/5 text-right">控制管理</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(user => {
                    const isSelf = user.id === currentUser.id;
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            {user.username}
                            {isSelf && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-normal">
                                当前我的
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">{getRoleBadge(user)}</td>
                        <td className="p-3 text-slate-500">
                          {user.role === 'branch' ? (
                            <div className="flex items-center gap-1">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              <span>{user.branchName || '未命名'}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">一</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-mono tracking-widest bg-slate-50/50 rounded text-center font-bold">
                          🔐 {user.pin}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setEditUsername(user.username);
                                setEditRole(user.role);
                                setEditBranchName(user.branchName || '');
                                setEditPin(user.pin);
                              }}
                              className="p-1.5 rounded-lg border border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
                              title="编辑账户信息及密码"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Enable/Disable Button */}
                            <button
                              onClick={() => handleToggleActive(user)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer duration-150 ${
                                user.isActive 
                                  ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 disabled:opacity-50' 
                                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                              }`}
                              title={user.isActive ? '点击禁用账号' : '点击启用账号'}
                            >
                              {user.isActive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={isSelf}
                              className="p-1.5 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="删除账户"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        未找到匹配搜索条件的账户
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* SUPPLIER MERCHANDISER ALLOCATION UI */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Create / Edit Supplier Form */}
          <div className={`rounded-xl border shadow-sm p-4 md:p-6 h-fit space-y-4 ${editingSupplier ? 'bg-indigo-50/10 border-indigo-200 animate-fadeIn' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600">
                <Truck className="w-5 h-5 animate-pulse" />
                <h3 className="font-semibold text-slate-850 text-sm md:text-base">
                  {editingSupplier ? '📝 修改供货商跟单协议' : '🏭 新增签约供货厂商'}
                </h3>
              </div>
              {editingSupplier && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierName('');
                    setSupplierContact('');
                    setSupplierPhone('');
                    setSupplierMerchandiser('');
                    setSupplierLeadTime('');
                  }} 
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  取消编辑
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 pt-2 border-t border-slate-150 text-left">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">🏢 供应商/工厂全称 (必填)</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 九牧卫浴制造厂"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">👤 联系负责人</label>
                  <input
                    type="text"
                    placeholder="张经理"
                    value={supplierContact}
                    onChange={e => setSupplierContact(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">📞 联系电话</label>
                  <input
                    type="text"
                    placeholder="1388xxxxxxxx"
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-indigo-50/40 p-3 rounded-lg border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-900 flex items-center gap-1">
                  <span>👤 绑定本司采购专属跟单员</span>
                </label>
                <p className="text-[10px] text-indigo-600 mb-1.5 leading-relaxed font-semibold">分店提报该厂货品时，自动分配到此跟单采购账号。</p>
                <div className="space-y-1.5">
                  <select
                    value={supplierMerchandiser}
                    onChange={e => setSupplierMerchandiser(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 font-bold"
                  >
                    <option value="">-- 手动录入 或 快捷指派采购账户 --</option>
                    {users
                      .filter(u => u.role === 'purchasing' || u.role === 'admin')
                      .map(u => (
                        <option key={u.id} value={u.username}>
                          {u.username} ({u.role === 'purchasing' ? '采购部人员' : '超级管理员'})
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    placeholder="若名单内没有，可直接在此处手打输入跟单姓名"
                    value={supplierMerchandiser}
                    onChange={e => setSupplierMerchandiser(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>📅 意向预估交期约定</span>
                </label>
                <div className="space-y-1.5">
                  <select
                    value={supplierLeadTime}
                    onChange={e => setSupplierLeadTime(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- 无特殊意向交期 (留空，作为默认值) --</option>
                    <option value="有交期: 预计 3天内极速发货">有交期: 预计 3天内极速发货</option>
                    <option value="有交期: 预计 5-7天内生产发出">有交期: 预计 5-7天内生产发出</option>
                    <option value="有交期: 预计 10天左右备好货">有交期: 预计 10天左右备好货</option>
                    <option value="默认无交期 (走现货安排)">默认无交期 (走现货安排)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="或纯手写输入交期: 例如 [3天], [常备货]"
                    value={supplierLeadTime}
                    onChange={e => setSupplierLeadTime(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium placeholder-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">若无指定，前台/采购审核订单展现时显示为：“无预设交期 (走现货)”</p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSupplier}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs md:text-sm font-semibold hover:shadow transition-all cursor-pointer disabled:bg-slate-300 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmittingSupplier ? '正在更新中...' : editingSupplier ? '⚡ 确认保存并更新分配关系' : '⚡ 确认登记该供应商并智能指派'}</span>
              </button>
            </form>
          </div>

          {/* Supplier Grid list */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="text-left">
                <dt className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                  <span>合作商与采购跟单归属登记表</span>
                </dt>
                <dd className="text-[11px] text-slate-400 mt-0.5">
                  绑定后，分店申购或前台确认认领该工厂时，全自动智能转入该跟单员下。
                </dd>
              </div>

              {/* Searchbox */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索供货商名 / 归属负责人"
                  value={supplierSearchQuery}
                  onChange={e => setSupplierSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Grid display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers
                .filter(s => 
                  !supplierSearchQuery.trim() || 
                  s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || 
                  (s.merchandiserName && s.merchandiserName.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
                )
                .map(sup => (
                  <div key={sup.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-indigo-100 hover:bg-white transition-all space-y-2.5 text-left relative group">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs md:text-sm">{sup.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          负责人: <span className="text-slate-600 font-semibold">{sup.contact || '暂无备案'}</span> | 电话: {sup.phone || '暂无号码'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingSupplier(sup);
                            setSupplierName(sup.name);
                            setSupplierContact(sup.contact || '');
                            setSupplierPhone(sup.phone || '');
                            setSupplierMerchandiser(sup.merchandiserName || '');
                            setSupplierLeadTime(sup.leadTimeText || '');
                          }}
                          className="p-1 hover:bg-indigo-100 text-indigo-600 rounded bg-indigo-50 md:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold"
                          title="编辑该合作方"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(sup)}
                          className="p-1 hover:bg-rose-100 text-rose-600 bg-rose-50 rounded md:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold"
                          title="删除解除合作"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                      <div className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                        👤 专属采购跟单: 
                        <span className="underline decoration-wavy font-extrabold text-blue-800">{sup.merchandiserName || '🚨 未绑定-由前台决定'}</span>
                      </div>

                      <div className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                        📅 交期约定: <span className="font-semibold text-slate-800">{sup.leadTimeText || '💬 默认无指定交期 (走现货)'}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {suppliers.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                暂未注册任何供应商，请从左侧录入
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
