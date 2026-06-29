import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle
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
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'suppliers' | 'database'>('users');
  
  // Database maintenance state
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  
  // Database selective clear state
  const [targetBranchName, setTargetBranchName] = useState<string>('');
  const [targetPurchaserName, setTargetPurchaserName] = useState<string>('');
  const [targetReceptionistName, setTargetReceptionistName] = useState<string>('');
  const [targetStartDate, setTargetStartDate] = useState<string>('');
  const [targetEndDate, setTargetEndDate] = useState<string>('');
  
  // Suppliers management state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierMerchandiser, setSupplierMerchandiser] = useState('');
  const [selectedMerchandisers, setSelectedMerchandisers] = useState<string[]>([]);
  const [customMerchandiserInput, setCustomMerchandiserInput] = useState('');
  const [supplierLeadTime, setSupplierLeadTime] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  const loadSuppliersList = () => {
    DbService.getSuppliers().then(sups => {
      setSuppliers(sups);
    });
  };

  const [dbStatus, setDbStatus] = useState<{
    supabaseEnabled: boolean;
    supabaseConfigured: boolean;
    pgConfigured: boolean;
    activeClient: string;
  } | null>(null);

  useEffect(() => {
    loadSuppliersList();
    fetch('/api/db/status')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(err => console.error('Error fetching database status:', err));
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('branch');
  const [branchName, setBranchName] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isViceAdmin, setIsViceAdmin] = useState(false);
  const [branchSalesEnabled, setBranchSalesEnabled] = useState(false);
  const [branchStockEnabled, setBranchStockEnabled] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<Role>('branch');
  const [editBranchName, setEditBranchName] = useState('');
  const [editPin, setEditPin] = useState('');

  const [editIsViceAdmin, setEditIsViceAdmin] = useState(false);
  const [editBranchSalesEnabled, setEditBranchSalesEnabled] = useState(false);
  const [editBranchStockEnabled, setEditBranchStockEnabled] = useState(false);

  // Account Bulk Excel Import/Export Workspace States
  const [showImportUserPanel, setShowImportUserPanel] = useState(false);
  const [importUsersPreview, setImportUsersPreview] = useState<{ username: string; role: Role; branchName?: string; pin: string; isActive: boolean; error?: string }[]>([]);
  const [importOverwrite, setImportOverwrite] = useState(true);

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

    // Validate limit rules
    if (editRole === 'admin' && editIsViceAdmin) {
      const viceAdminsCount = users.filter(u => u.role === 'admin' && u.isViceAdmin === true && u.id !== editingUser.id).length;
      if (viceAdminsCount >= 5) {
        alert('🎨 【系统安全红线】系统中已存在 5 个副管理员账户，额度已满，无法分配更多副管理员！');
        return;
      }
    }

    if (editRole === 'branch') {
      const branchCount = users.filter(u => u.role === 'branch' && u.id !== editingUser.id).length;
      if (branchCount >= 300) {
        alert('🏪 【系统额度红线】系统中已存在 300 个分店账户，额度已满，无法注册更多分店！');
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
      updatedUser.branchSalesEnabled = editBranchSalesEnabled;
      updatedUser.branchStockEnabled = editBranchStockEnabled;
      delete updatedUser.isViceAdmin;
    } else if (editRole === 'admin') {
      updatedUser.isViceAdmin = editIsViceAdmin;
      delete updatedUser.branchName;
      delete updatedUser.branchSalesEnabled;
      delete updatedUser.branchStockEnabled;
    } else {
      delete updatedUser.branchName;
      delete updatedUser.branchSalesEnabled;
      delete updatedUser.branchStockEnabled;
      delete updatedUser.isViceAdmin;
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

  const handleResetUserPasswordDirect = async (user: User, newPin: string) => {
    try {
      const updatedUser: User = {
        ...user,
        pin: newPin.trim(),
      };
      await onSaveUser(updatedUser);
      alert(`🎉 账户 [${user.username}] 的登录密码已成功重置为：${newPin}！此修改已无缝同步至云端。`);
    } catch (err: any) {
      console.error(err);
      alert(`❌ 重置密码失败：${err.message || '未知错误'}`);
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

    // Validate limit rules
    if (role === 'admin' && isViceAdmin) {
      const viceAdminsCount = users.filter(u => u.role === 'admin' && u.isViceAdmin === true).length;
      if (viceAdminsCount >= 5) {
        alert('🎨 【系统安全红线】系统中已存在 5 个副管理员账户，额度已满，无法分配更多副管理员！');
        return;
      }
    }

    if (role === 'branch') {
      const branchCount = users.filter(u => u.role === 'branch').length;
      if (branchCount >= 300) {
        alert('🏪 【系统额度红线】系统中已存在 300 个分店账户，额度已满，无法注册更多分店！');
        return;
      }
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
      newUser.branchSalesEnabled = branchSalesEnabled;
      newUser.branchStockEnabled = branchStockEnabled;
    } else if (role === 'admin') {
      newUser.isViceAdmin = isViceAdmin;
    }

    try {
      await onSaveUser(newUser);
      // Reset
      setUsername('');
      setBranchName('');
      setPin('');
      setRole('branch');
      setIsViceAdmin(false);
      setBranchSalesEnabled(false);
      setBranchStockEnabled(false);
      alert(`账户 [${newUser.username}] 创建成功！`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Account Template download & exporting ---
  const downloadAccountTemplate = () => {
    try {
      const data = [
        ["账号名称（必填，唯一例: 城东分店）", "权限身份（必填：分店 / 采购 / 前台 / 管理员）", "关联分店名称（仅分店填，必须和实际名称一致）", "登录密码PIN码（推荐至少4位数字）", "是否启用（是 / 否）"],
        ["城东一号店", "分店", "城东第一分店", "123456", "是"],
        ["城西二号店", "分店", "城西第二分店", "888888", "是"],
        ["采购小陈", "采购", "", "666666", "是"],
        ["前台助理阿花", "前台", "", "999999", "是"],
        ["临过期休眠分店", "分店", "城南旧货仓库", "111111", "否"]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      ws['!cols'] = [
        { wch: 25 },
        { wch: 38 },
        { wch: 35 },
        { wch: 28 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "系统账号批量录入模板");
      XLSX.writeFile(wb, "多分店协同系统_账号批量导入导入模板.xlsx");
    } catch (err: any) {
      alert("下载模板出错：" + err.message);
    }
  };

  const exportCurrentAccounts = () => {
    try {
      const data = [
        ["账号名称（必填，唯一例: 城东分店）", "权限身份（必填：分店 / 采购 / 前台 / 管理员）", "关联分店名称（仅分店填，必须和实际名称一致）", "登录密码PIN码（推荐至少4位数字）", "是否启用（是 / 否）"]
      ];

      const roleNameMap: Partial<Record<Role, string>> = {
        'admin': '管理员',
        'branch': '分店',
        'receptionist': '前台',
        'purchasing': '采购',
        'boss': '老板/管理者',
        'region_manager': '区域经理',
        'data_admin': '数据管理员'
      };

      users.forEach(u => {
        data.push([
          u.username,
          roleNameMap[u.role] || u.role,
          u.branchName || '',
          u.pin,
          u.isActive !== false ? '是' : '否'
        ]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      ws['!cols'] = [
        { wch: 25 },
        { wch: 38 },
        { wch: 35 },
        { wch: 28 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "系统正在运行账号数据表");
      XLSX.writeFile(wb, "系统运行中账号导出数据.xlsx");
    } catch (err: any) {
      alert("导出数据出错：" + err.message);
    }
  };

  const handleImportUsersFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const resultBinary = evt.target?.result;
        if (!resultBinary) return;
        const data = new Uint8Array(resultBinary as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const parsedUsers: typeof importUsersPreview = [];
        let headerSkipped = false;

        const roleMap: Record<string, Role> = {
          'admin': 'admin',
          '管理员': 'admin',
          'branch': 'branch',
          '分店': 'branch',
          'receptionist': 'receptionist',
          '前台': 'receptionist',
          'purchasing': 'purchasing',
          '采购': 'purchasing',
          '采购员': 'purchasing',
          '采购主管': 'purchasing',
          'data_admin': 'data_admin',
          '数据管理员': 'data_admin'
        };

        for (const row of rawJson) {
          if (!Array.isArray(row) || row.length === 0) continue;

          const col0 = String(row[0] || '').trim();
          if (!headerSkipped && (col0.includes('账号') || col0.includes('必填') || col0.includes('名称') || col0.includes('Username'))) {
            headerSkipped = true;
            continue;
          }

          const usernameVal = String(row[0] || '').trim();
          const roleStr = String(row[1] || '').trim();
          const branchVal = String(row[2] || '').trim();
          const pinVal = String(row[3] || '').trim();
          const statusVal = String(row[4] || '').trim();

          if (!usernameVal) continue;

          // Resolve role
          let mappedRole: Role = 'branch';
          if (roleStr) {
            mappedRole = roleMap[roleStr.toLowerCase()] || roleMap[roleStr] || 'branch';
          }

          const isActiveVal = statusVal === '否' ? false : true;

          // Check for errors on this row
          let error = '';
          if (mappedRole === 'branch' && !branchVal) {
            error = '分店账号必须在【关联分店名称】注明该分店具体名字！';
          }

          parsedUsers.push({
            username: usernameVal,
            role: mappedRole,
            branchName: mappedRole === 'branch' ? branchVal : undefined,
            pin: pinVal || '123456',
            isActive: isActiveVal,
            error: error || undefined
          });
        }

        if (parsedUsers.length === 0) {
          alert('未能识别到任何有效的账号行数据！请确认识别表头位置没有乱。');
          return;
        }

        setImportUsersPreview(parsedUsers);
        alert(`成功解析出 ${parsedUsers.length} 个账户录入项！请在下方核算预览无误后，点击[确认批量导入]提交至服务器。`);
      } catch (err: any) {
        console.error(err);
        alert('读取解析 Excel 失败，请确保格式正确：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImportUsers = async () => {
    if (importUsersPreview.length === 0) return;
    const hasErrors = importUsersPreview.some(p => p.error);
    if (hasErrors) {
      const confirmForce = window.confirm('预览中存在标记为异常的账户行（例如缺少分店名称）。是否忽略有问题行，继续导入其他正常的账户？');
      if (!confirmForce) return;
    }

    const validItems = importUsersPreview.filter(p => !p.error);
    if (validItems.length === 0) {
      alert('无可导入的合法账户记录！');
      return;
    }

    // Validate boundary constraints
    const currentBranchCount = users.filter(u => u.role === 'branch').length;
    const newBranchesBatch = validItems.filter(item => {
      if (item.role !== 'branch') return false;
      const alreadyExists = users.some(u => u.username.toLowerCase() === item.username.toLowerCase() && u.role === 'branch');
      return !alreadyExists;
    }).length;

    if (currentBranchCount + newBranchesBatch > 300) {
      alert(`🏪 【分店数量红线】提交失败！本批次新增分店数为 ${newBranchesBatch}。当前已有分店数为 ${currentBranchCount}，合并后将超出 300 个分店数上限！`);
      return;
    }

    const currentViceCount = users.filter(u => u.role === 'admin' && u.isViceAdmin === true).length;
    const newViceBatch = validItems.filter(item => {
      if (item.role !== 'admin') return false;
      const isVice = item.username.includes('副');
      if (!isVice) return false;
      const alreadyExists = users.some(u => u.username.toLowerCase() === item.username.toLowerCase() && u.role === 'admin' && u.isViceAdmin === true);
      return !alreadyExists;
    }).length;

    if (currentViceCount + newViceBatch > 5) {
      alert(`🎨 【副管理员红线】提交失败！本批次新制副管理员数为 ${newViceBatch}。当前已有副管理员数为 ${currentViceCount}，合并后将超出 5 人上限！`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await DbService.importUsers(validItems, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      }, importOverwrite);

      alert(`🎉 恭喜！批量账号导入任务执行成功：\n- 录入全新账号：${result.imported} 个\n- 覆盖已有账号：${result.updated} 个\n- 跳过重名账密：${result.skipped} 个`);
      setImportUsersPreview([]);
      setShowImportUserPanel(false);
    } catch (e: any) {
      console.error(e);
      alert('批量提交失败：' + e.message);
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

  const handleAddMerchandiser = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedMerchandisers.includes(trimmed)) {
      setSelectedMerchandisers(prev => [...prev, trimmed]);
    }
    setCustomMerchandiserInput('');
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      alert('请填写公司/供应商名称');
      return;
    }

    setIsSubmittingSupplier(true);
    const joinedMerchandisers = selectedMerchandisers.join(', ');
    const updatedModel: Supplier = {
      id: editingSupplier ? editingSupplier.id : ('sup_' + Date.now() + Math.random().toString(36).substring(2, 6)),
      name: supplierName.trim(),
      contact: supplierContact.trim(),
      phone: supplierPhone.trim(),
      isActive: editingSupplier ? editingSupplier.isActive : true,
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      merchandiserName: joinedMerchandisers.trim() || undefined,
      leadTimeText: supplierLeadTime.trim() || undefined
    };

    try {
      await DbService.saveSupplier(updatedModel, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      // clear
      setSupplierName('');
      setSupplierContact('');
      setSupplierPhone('');
      setSupplierMerchandiser('');
      setSelectedMerchandisers([]);
      setCustomMerchandiserInput('');
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
        const isVice = user.isViceAdmin;
        return (
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${
            isVice 
              ? 'bg-amber-50 text-amber-700 border-amber-105' 
              : 'bg-rose-50 text-rose-700 border-rose-105'
          }`}>
            {isVice ? '副管理员' : '系统管理员(总)'}
          </span>
        );
      case 'branch':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-700 border border-green-105">分店账户</span>;
      case 'receptionist':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-105">前台汇总</span>;
      case 'purchasing':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-105">采购</span>;
      case 'data_admin':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-105">数据管理员</span>;
      case 'boss':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-900 text-white border border-slate-700">老板 / 决策者</span>;
      case 'region_manager':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-sky-50 text-sky-700 border border-sky-105">区域经理</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-50 text-slate-700 border border-slate-200">{user.role}</span>;
    }
  };

  const handleClearData = async () => {
    if (selectedCollections.length === 0) {
      alert('请至少勾选一个要清空的数据集！');
      return;
    }

    if (confirmInput.trim().toUpperCase() !== 'CONFIRM') {
      alert('请在输入框内输入 "CONFIRM" 来确认此项毁灭性清空操作。');
      return;
    }

    const colLabels = selectedCollections.map(c => {
      switch (c) {
        case 'db_orders': return '订货单数据';
        case 'db_purchase_orders': return '采购分配合同';
        case 'db_arrivals': return '到货验收记录';
        case 'db_inventory': return '期初/账面库存明细';
        case 'db_branch_stocks': return '分店实物库存';
        case 'db_products': return '商品库主数据';
        case 'db_suppliers': return '供应商往来单位';
        case 'db_sales_records': return '分店零售月报';
        case 'db_independent_purchase_orders': return '缺货自主补货单';
        case 'db_users': return '协者用户账号';
        case 'db_logs': return '系统操作日志';
        default: return c;
      }
    });

    const isSelective = !!(targetBranchName || targetPurchaserName || targetReceptionistName || targetStartDate || targetEndDate);
    const filterInfo = [
      targetBranchName ? `分店: ${targetBranchName}` : '',
      targetPurchaserName ? `采购员: ${targetPurchaserName}` : '',
      targetReceptionistName ? `前台/验货: ${targetReceptionistName}` : '',
      (targetStartDate || targetEndDate) ? `时间范围: ${targetStartDate || '不限'} 至 ${targetEndDate || '不限'}` : ''
    ].filter(Boolean).join('、');

    let confirmMsg = `⚠️ 安全警告 ⚠️\n\n您即将清空以下 [${selectedCollections.length}] 个数据集：\n${colLabels.join('、')}\n\n该操作无法撤销，数据将从 Supabase/PostgreSQL 数据库中永久抹除！您确定要继续吗？`;
    if (isSelective) {
      confirmMsg = `⚠️ 靶向局部清洗警告 ⚠️\n\n您即将对特定对象进行数据清空：\n【${filterInfo}】\n\n受影响的所选 [${selectedCollections.length}] 个数据集如下：\n${colLabels.join('、')}\n\n该操作仅会抹除/筛选删除属于上述特定对象的记录。确定要执行该局部清洗操作吗？`;
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsClearing(true);
    try {
      const operator = {
        id: currentUser?.id || 'admin',
        name: currentUser?.username || '管理员',
        role: currentUser?.role || 'admin'
      };
      
      const filter = isSelective ? {
        branchName: targetBranchName || undefined,
        purchaserName: targetPurchaserName || undefined,
        receptionistName: targetReceptionistName || undefined,
        startDate: targetStartDate || undefined,
        endDate: targetEndDate || undefined
      } : undefined;

      await DbService.clearCollections(selectedCollections, operator, filter);
      
      alert(isSelective 
        ? `🎉 靶向局部清洗成功！已安全清洗属于 ${filterInfo} 的相关数据，其他不匹配的数据被安全保留。`
        : '🎉 恭喜！所选数据集已成功从 PostgreSQL/Supabase 数据库中安全抹去，数据已置空。'
      );
      setSelectedCollections([]);
      setConfirmInput('');
      setTargetBranchName('');
      setTargetPurchaserName('');
      setTargetReceptionistName('');
      setTargetStartDate('');
      setTargetEndDate('');
      
      if (selectedCollections.includes('db_users')) {
        alert('💡 提示：协同账号已重置，管理员（admin）及您的当前登录账号已自动保留，其余协作账号已被清除。');
      }
      
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(`❌ 清空失败：${err.message || '未知错误'}`);
    } finally {
      setIsClearing(false);
    }
  };

  const selectAllCollections = () => {
    setSelectedCollections([
      'db_orders',
      'db_purchase_orders',
      'db_arrivals',
      'db_inventory',
      'db_branch_stocks',
      'db_products',
      'db_suppliers',
      'db_sales_records',
      'db_independent_purchase_orders',
      'db_users',
      'db_logs'
    ]);
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
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('database')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'database' 
                ? 'border-blue-600 text-blue-600 mb-[-2px]' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            💾 数据库维护与清空重置
          </button>
        )}
      </div>

      {activeSubTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 安全温馨提示栏 */}
          <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-4 text-xs text-emerald-800 leading-relaxed flex items-start gap-3 shadow-xs">
            <span className="p-1 bg-emerald-100 rounded text-base">🛡️</span>
            <div className="space-y-1">
              <div className="font-bold text-emerald-950 text-sm">正式上线账号安全加固已完成</div>
              <p className="text-slate-600">
                为防止真实系统上线后账号密码暴露，<strong>登录页面的“系统演示账号”展示板及一键重置按钮已全部移除</strong>。
                作为系统最高管理员，您可在此安全查看、重设或新增所有系统子账号。下方表格已明文呈现当前所有的登录PIN码（即登录密码），正式投产时请务必在这里提前调整好各分店和采购员的私密密码，确保系统数据安全。
              </p>
            </div>
          </div>

          {/* 数据库与云端连接体检中心 */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-base p-1 bg-blue-50 text-blue-600 rounded">🔌</span>
              <div>
                <div className="font-bold text-slate-800 text-sm">云端数据库与环境变量体检中心</div>
                <div className="text-slate-500 mt-0.5">
                  自动检测 Vercel 环境变量及 Supabase 服务的健康状况和配置一致性
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                dbStatus?.supabaseConfigured 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                Supabase 环境变量: {dbStatus?.supabaseConfigured ? '🟢 已配妥 (已检测到 SUPABASE_URL & KEY)' : '🟡 未配妥 (请检查环境变量配置)'}
              </span>
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                dbStatus?.activeClient.includes('Supabase')
                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                活动引擎: {dbStatus ? dbStatus.activeClient : '正在检测中...'}
              </span>
            </div>
          </div>

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
                    <option value="data_admin">数据管理员 (价格与财务数据维护，提交/汇总数据给老板)</option>
                    <option value="admin">系统管理员 - 总/副 (最高账号管理、报警线及查看日志)</option>
                  </select>
                </div>

                {editRole === 'admin' && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-150 rounded-lg animate-fadeIn">
                    <input
                      type="checkbox"
                      id="editIsViceAdmin"
                      checked={editIsViceAdmin}
                      onChange={e => setEditIsViceAdmin(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="editIsViceAdmin" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      是否设为副管理员账号 (禁止增删账号、禁用账号、修改全局配置)
                    </label>
                  </div>
                )}

                {editRole === 'branch' && (
                  <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-150 rounded-lg animate-fadeIn">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-600">关联本分店名称</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="例如：城东分店"
                          value={editBranchName}
                          onChange={e => setEditBranchName(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-855 font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50">
                      <input
                        type="checkbox"
                        id="editBranchSalesEnabled"
                        checked={editBranchSalesEnabled}
                        onChange={e => setEditBranchSalesEnabled(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="editBranchSalesEnabled" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                        分店可查看本店销售报表 (近3月平均，历史平均)
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="editBranchStockEnabled"
                        checked={editBranchStockEnabled}
                        onChange={e => setEditBranchStockEnabled(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="editBranchStockEnabled" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                        分店可在库导入及订货提示
                      </label>
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
                {currentUser?.isViceAdmin ? (
                  <div className="p-3 bg-slate-100 rounded-lg text-slate-500 border border-slate-200 border-dashed text-xs text-center font-semibold leading-normal">
                    ⚙️ 您当前是【副管理员】身份，无权新增、删除或禁用系统账户。
                  </div>
                ) : (
                  <>
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
                        <option value="data_admin">数据管理员 (价格与财务数据维护，提交/汇总数据给老板)</option>
                        <option value="admin">系统管理员 - 总/副 (最高账号管理、报警线及查看日志)</option>
                      </select>
                    </div>

                    {role === 'admin' && (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-150 rounded-lg animate-fadeIn">
                        <input
                          type="checkbox"
                          id="isViceAdmin"
                          checked={isViceAdmin}
                          onChange={e => setIsViceAdmin(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="isViceAdmin" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          是否设为副管理员账号 (禁止增删账号、禁用账号、修改全局配置)
                        </label>
                      </div>
                    )}

                    {role === 'branch' && (
                      <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-150 rounded-lg animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600">关联本分店名称</label>
                          <div className="relative">
                            <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              placeholder="例如：城东分店"
                              value={branchName}
                              onChange={e => setBranchName(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-855 font-semibold"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
                          <input
                            type="checkbox"
                            id="branchSalesEnabled"
                            checked={branchSalesEnabled}
                            onChange={e => setBranchSalesEnabled(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="branchSalesEnabled" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                            允许此分店单独开启近3月及往期销量查看权限
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="branchStockEnabled"
                            checked={branchStockEnabled}
                            onChange={e => setBranchStockEnabled(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="branchStockEnabled" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                            允许此分店单独打开自身在库量导入及参考订货提示
                          </label>
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
                  </>
                )}
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

            {/* Account Multi-Tool Operations (Excel Import/Export & Template Download) */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 shadow-3xs">
              <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                <span>表格导入导出工具箱</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadAccountTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs"
                  title="获取格式正确的 Excel 账号字段导入模板，避免列错位"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  下载空白账号模板.xlsx
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportUserPanel(!showImportUserPanel);
                    setImportUsersPreview([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-1xs ${
                    showImportUserPanel ? 'bg-amber-600 hover:bg-amber-750 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {showImportUserPanel ? '收起导入模块' : 'Excel/CSV 批量导账号'}
                </button>
                <button
                  type="button"
                  onClick={exportCurrentAccounts}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-650 hover:bg-emerald-700 bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-1xs"
                  title="导出全系统现有成员账密备份"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  备份当前全厂账号表.xlsx
                </button>
              </div>
            </div>

            {/* Interactive Importer Panel for Accounts */}
            {showImportUserPanel && (
              <div className="p-4 md:p-5 border border-slate-200/80 rounded-xl bg-slate-50 space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-white border border-slate-150 p-4 rounded-xl shadow-3xs">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">第一步：下载 / 准备您的账号批导 Excel 文件</h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      建议直接使用右侧提供的官方标准模版，包含：<strong>账号名称、权限身份、关联分店名称、登录密码PIN码、是否启用</strong> 5 列。
                    </p>
                    <p className="text-[10px] text-indigo-500 leading-normal font-semibold">
                      💡 角色名称支持模糊识别：分店也可以写“branch”，管理员也可以写“admin”，前台写“receptionist”，采购写“purchasing”。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadAccountTemplate}
                    className="shrink-0 flex items-center gap-1.2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 cursor-pointer self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载空白模版文件
                  </button>
                </div>

                {/* Dropzone File Selector */}
                <div className="p-6 bg-white border border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center gap-3 text-center transition-all hover:bg-blue-50/10">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-3xs">
                    <Upload className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-slate-800">第二步：选中您编辑妥当的账户工作表 (.xlsx, .xls, .csv)</h5>
                    <p className="text-[10px] text-slate-400">系统已经部署完毕 XLSX 解析引擎，瞬间读取上百个分店账号并且智能分析重名排重。</p>
                  </div>
                  <label className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer inline-block">
                    选择并解析本地 Excel 表格
                    <input
                      type="file"
                      id="upload_accounts_xlsx"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportUsersFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Overwrite or skip configuration select */}
                {importUsersPreview.length > 0 && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                        <h5 className="text-xs font-extrabold text-slate-800">第三步：账户核验预览 (共识别出 {importUsersPreview.length} 项)</h5>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-bold">若全系统已存在同名账户时：</span>
                        <select
                          value={importOverwrite ? 'true' : 'false'}
                          onChange={e => setImportOverwrite(e.target.value === 'true')}
                          className="text-[11px] font-bold text-slate-700 border border-slate-200 rounded px-2.5 py-1 bg-slate-50 outline-none"
                        >
                          <option value="true">🔄 覆盖密码与角色(推荐)</option>
                          <option value="false">⏭️ 跳过不用更改</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick Preview Table with detailed statuses */}
                    <div className="max-h-60 overflow-y-auto border border-slate-150 rounded-lg">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-150">
                          <tr>
                            <th className="p-2.5">账号名称</th>
                            <th className="p-2.5">权限身份</th>
                            <th className="p-2.5">关联分店</th>
                            <th className="p-2.5">登录PIN码</th>
                            <th className="p-2.5">状态</th>
                            <th className="p-2.5 text-right">检查结果</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importUsersPreview.map((item, idx) => {
                            const matchedExist = users.find(u => u.username.toLowerCase() === item.username.toLowerCase());
                            return (
                              <tr key={idx} className={`hover:bg-slate-50/50 ${item.error ? 'bg-rose-50/40' : matchedExist ? 'bg-amber-55/20 bg-amber-50/30' : ''}`}>
                                <td className="p-2.5 font-bold text-slate-800">{item.username}</td>
                                <td className="p-2.5 font-semibold text-slate-700">
                                  {item.role === 'admin' ? '⚙️ 管理员' :
                                   item.role === 'branch' ? '🏠 分店' :
                                   item.role === 'receptionist' ? '💁 前台' :
                                   item.role === 'data_admin' ? '🪙 数据管理员' : '💼 采购'}
                                </td>
                                <td className="p-2.5 text-slate-550 font-medium text-slate-500">{item.branchName || '—'}</td>
                                <td className="p-2.5 font-mono font-bold text-indigo-700">{item.pin}</td>
                                <td className="p-2.5 font-semibold">{item.isActive ? '🟢 启用' : '🔴 禁用'}</td>
                                <td className="p-2.5 text-right font-bold text-[10px]">
                                  {item.error ? (
                                    <span className="text-rose-600">❌ {item.error}</span>
                                  ) : matchedExist ? (
                                    <span className="text-amber-600">⚠️ 已存在 (将覆盖)</span>
                                  ) : (
                                    <span className="text-emerald-600">✅ 正常(全新)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setImportUsersPreview([])}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-500 cursor-pointer"
                      >
                        清空此预览
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmImportUsers}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-705 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
                      >
                        ⚡ 确认批量导入录入到系统 ({importUsersPreview.filter(p => !p.error).length} 项)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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

                            {/* Quick Admin Password Reset Button */}
                            <button
                              onClick={() => {
                                const newPass = prompt(`🔑 您正在安全重置账号 [${user.username}] 的登录密码。\n请输入该成员的新密码 / 安全PIN码:`, user.pin);
                                if (newPass === null) return;
                                if (!newPass.trim()) {
                                  alert('密码/PIN 码不能为空！');
                                  return;
                                }
                                handleResetUserPasswordDirect(user, newPass.trim());
                              }}
                              className="p-1.5 rounded-lg border border-blue-150 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                              title="管理员一键重置密码 (无需邮件)"
                            >
                              <Key className="w-3.5 h-3.5" />
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
      </div>
      )}

      {activeSubTab === 'suppliers' && (
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
                    setSelectedMerchandisers([]);
                    setCustomMerchandiserInput('');
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

              <div className="space-y-2 bg-indigo-50/40 p-3 rounded-lg border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
                  <span>👤 绑定本司采购专属跟单员 (可多选/手打)</span>
                  {selectedMerchandisers.length > 0 && (
                    <span className="text-[10px] text-indigo-500 font-bold font-mono">已指派 {selectedMerchandisers.length} 人</span>
                  )}
                </label>
                <p className="text-[10px] text-indigo-600 mb-1.5 leading-relaxed font-semibold">分店提报该厂货品时，自动分配到此跟单采购账号。</p>
                
                <div className="space-y-2">
                  {/* Current Selected Tags */}
                  {selectedMerchandisers.length > 0 ? (
                    <div className="flex flex-wrap gap-1 p-1.5 bg-white border border-slate-200 rounded-lg min-h-[34px]">
                      {selectedMerchandisers.map(name => (
                        <div key={name} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedMerchandisers(prev => prev.filter(n => n !== name))}
                            className="hover:text-indigo-900 text-slate-400 hover:bg-slate-200/50 rounded-full w-3.5 h-3.5 flex items-center justify-center font-extrabold focus:outline-none ml-0.5 cursor-pointer select-none"
                            title="移除此人"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic p-1.5 bg-slate-50 border border-slate-200 border-dashed rounded-lg text-center select-none font-medium">
                      暂无指派采购员 (默认留空)
                    </div>
                  )}

                  {/* Input and add button */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="手打输入跟单姓名，点右侧[添加]或回车"
                      value={customMerchandiserInput}
                      onChange={e => setCustomMerchandiserInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customMerchandiserInput.trim()) {
                            handleAddMerchandiser(customMerchandiserInput);
                          }
                        }
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold placeholder-slate-400 outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customMerchandiserInput.trim()) {
                          handleAddMerchandiser(customMerchandiserInput);
                        }
                      }}
                      className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center shadow-3xs"
                    >
                      添加
                    </button>
                  </div>

                  {/* Quick select dropdown */}
                  <div className="space-y-1">
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          handleAddMerchandiser(e.target.value);
                        }
                      }}
                      className="w-full text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none text-slate-600 focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="">💡 快捷点选已有账户 (不需滚动寻找)</option>
                      {users
                        .filter(u => u.role === 'purchasing' || u.role === 'admin')
                        .map(u => (
                          <option key={u.id} value={u.username} disabled={selectedMerchandisers.includes(u.username)}>
                            {u.username} ({u.role === 'purchasing' ? '采购部' : '主管'}) {selectedMerchandisers.includes(u.username) ? ' (已加)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
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
                            setSelectedMerchandisers(sup.merchandiserName ? sup.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean) : []);
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

      {activeSubTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left panel: clear collections */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm md:text-base">毁灭性清空/高级数据维护</h3>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-900 text-xs leading-relaxed space-y-1.5">
                <div className="font-bold">⚠️ 安全警告与重要规则：</div>
                <div>1. 勾选需要清空的数据并执行清空，数据将从 <strong>PostgreSQL/Supabase</strong> 中彻底擦除，不可撤销！</div>
                <div>2. 清空前，建议通过系统各模块页面（如库存明细、分店月报、提单溯源）的<strong>「导出为 Excel / 导出数据」</strong>按钮进行手动备份。</div>
                <div>3. 为了防止系统锁定，在勾选清空「协作者用户账号」时，<strong>系统会自动保留您当前的管理员账号</strong>，您可以安全地进行测试。</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllCollections}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                >
                  ☑️ 全选
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCollections([])}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                >
                  ☒ 全不选
                </button>
              </div>

              {/* Grid of checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {[
                  { key: 'db_orders', label: '分店协同订货单 (db_orders)', desc: '包含分店所有的协同申报单、周期性订货及流转状态。' },
                  { key: 'db_purchase_orders', label: '采购合同与厂家单 (db_purchase_orders)', desc: '采购合并计划、跟单记录及供应商发货进度。' },
                  { key: 'db_arrivals', label: '到货实物入库验收 (db_arrivals)', desc: '前台接收单验收、入库核对数据。' },
                  { key: 'db_inventory', label: '期初/实物账面库存 (db_inventory)', desc: '总部的账面商品存货明细、批次及库存警戒线。' },
                  { key: 'db_branch_stocks', label: '分店及区域门店库存 (db_branch_stocks)', desc: '各个分店实物在店库存。' },
                  { key: 'db_products', label: '基础商品主数据 (db_products)', desc: '系统的核心商品名录、编号、单价配置。' },
                  { key: 'db_suppliers', label: '供应商往来名录 (db_suppliers)', desc: '供应商基本信息及跟单采购员分配。' },
                  { key: 'db_sales_records', label: '历史零售与销售月报 (db_sales_records)', desc: '分店提报的历史零售明细流水。' },
                  { key: 'db_independent_purchase_orders', label: '缺货自主补货记录 (db_independent_purchase_orders)', desc: '向厂家自主提起的补充采购。' },
                  { key: 'db_users', label: '协作者账号密码 (db_users)', desc: '清空其他子账户（系统自动保留主管理员）。' },
                  { key: 'db_logs', label: '系统安全与操作日志 (db_logs)', desc: '所有成员的后台交互与操作追溯记录。' }
                ].map(col => {
                  const checked = selectedCollections.includes(col.key);
                  return (
                    <div
                      key={col.key}
                      onClick={() => {
                        if (checked) {
                          setSelectedCollections(selectedCollections.filter(k => k !== col.key));
                        } else {
                          setSelectedCollections([...selectedCollections, col.key]);
                        }
                      }}
                      className={`p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-2.5 hover:shadow-sm select-none ${
                        checked ? 'bg-rose-50/20 border-rose-200 ring-1 ring-rose-200' : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}} // Handle on parent div click
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 pointer-events-none cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <div className={`text-xs font-bold ${checked ? 'text-rose-900' : 'text-slate-800'}`}>
                          {col.label}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-normal font-medium">
                          {col.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 靶向选择过滤器 */}
              <div className="p-4 bg-amber-50/45 border border-amber-200/50 rounded-xl space-y-4">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                  <span>🎯 靶向局部数据清洗过滤器 (可选)</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  如果您只想清除<strong>某个分店、某个采购员、某个前台</strong>，或<strong>特定时间段内</strong>的异常/测试数据，请在下方选择对应对象或时间。不选则代表不进行对应限制。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">分店筛选 (保留其他店数据)</label>
                    <select
                      value={targetBranchName}
                      onChange={e => setTargetBranchName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="">全部分店 (不限)</option>
                      {Array.from(new Set(users.filter(u => u.role === 'branch').map(u => u.branchName || u.username))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">采购跟单筛选 (保留其他采购员)</label>
                    <select
                      value={targetPurchaserName}
                      onChange={e => setTargetPurchaserName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="">全部采购跟单 (不限)</option>
                      {Array.from(new Set(users.filter(u => u.role === 'purchasing').map(u => u.username))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">前台验货员筛选 (保留其他前台)</label>
                    <select
                      value={targetReceptionistName}
                      onChange={e => setTargetReceptionistName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="">全部前台/验货 (不限)</option>
                      {Array.from(new Set(users.filter(u => u.role === 'receptionist').map(u => u.username))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">起始日期 (可选时间过滤)</label>
                    <input
                      type="date"
                      value={targetStartDate}
                      onChange={e => setTargetStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-700 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">结束日期 (可选时间过滤)</label>
                    <input
                      type="date"
                      value={targetEndDate}
                      onChange={e => setTargetEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-700 font-medium"
                    />
                  </div>
                </div>
                {(targetBranchName || targetPurchaserName || targetReceptionistName || targetStartDate || targetEndDate) && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100 font-bold flex items-center justify-between">
                    <span>
                      📌 局部清洗模式已激活：仅清除
                      {[
                        targetBranchName ? `【分店: ${targetBranchName}】` : '',
                        targetPurchaserName ? `【采购: ${targetPurchaserName}】` : '',
                        targetReceptionistName ? `【前台: ${targetReceptionistName}】` : '',
                        targetStartDate ? `【起始日期: ${targetStartDate}】` : '',
                        targetEndDate ? `【结束日期: ${targetEndDate}】` : ''
                      ].filter(Boolean).join(' + ')}
                      的数据，其余不吻合的数据将安全保留。
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetBranchName('');
                        setTargetPurchaserName('');
                        setTargetReceptionistName('');
                        setTargetStartDate('');
                        setTargetEndDate('');
                      }}
                      className="text-[9px] text-rose-600 hover:underline font-extrabold cursor-pointer"
                    >
                      ✕ 撤销筛选
                    </button>
                  </div>
                )}
              </div>

              {/* Execution panel */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-rose-700">
                    💡 请输入 "CONFIRM" 确认执行此毁灭性清空操作：
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={e => setConfirmInput(e.target.value)}
                    placeholder="输入 CONFIRM 以激活清空按钮"
                    className="w-full max-w-md px-3 py-2 border border-rose-250 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold uppercase bg-rose-50/10 placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isClearing || confirmInput.trim().toUpperCase() !== 'CONFIRM' || selectedCollections.length === 0}
                    onClick={handleClearData}
                    className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                      isClearing || confirmInput.trim().toUpperCase() !== 'CONFIRM' || selectedCollections.length === 0
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 cursor-pointer'
                    }`}
                  >
                    {isClearing ? '⏳ 正在彻底执行清空抹去...' : `🔥 立即安全清除已选的 [${selectedCollections.length}] 个表数据`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Import / Export guide */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4 leading-relaxed text-xs">
              <div className="font-extrabold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-150">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                测试数据 Excel 批量上传入口指南
              </div>
              <div className="text-slate-500 space-y-3.5">
                <p>
                  当您将数据库清空后，可以通过系统各模块自带的 Excel/CSV 批量导入功能，非常方便地上传您的真实业务数据进行测试：
                </p>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-600">1.</span> 👥 协作者多端子账号
                  </div>
                  <div className="pl-4 text-[11px] text-slate-400 leading-normal">
                    <strong>入口</strong>: 当前标签页 <strong>「成员账号管理与安全」</strong>
                    <br />
                    <strong>说明</strong>: 点击右侧「Excel 批量导入成员」展开面板，下载模板并填写即可一键录入。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-600">2.</span> 🏭 供应商与专属跟单
                  </div>
                  <div className="pl-4 text-[11px] text-slate-400 leading-normal">
                    <strong>入口</strong>: 当前标签页 <strong>「供应商与跟单分配」</strong>
                    <br />
                    <strong>说明</strong>: 右上角支持直接新增，或通过内置供应商管理进行批量登记。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-600">3.</span> 📦 基础商品库与期初库存
                  </div>
                  <div className="pl-4 text-[11px] text-slate-400 leading-normal">
                    <strong>入口</strong>: <strong>「账面库存监管 (库存实物明细)」</strong> 页面
                    <br />
                    <strong>说明</strong>: 点击 <strong>「Excel 批量录入/盘点导入」</strong> 下载对应模板，导入商品基本属性、编码和实物期初账面数。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-600">4.</span> 📊 历史零售明细月报
                  </div>
                  <div className="pl-4 text-[11px] text-slate-400 leading-normal">
                    <strong>入口</strong>: <strong>「分店零售分析 (零售月报模型)」</strong> 页面
                    <br />
                    <strong>说明</strong>: 可通过 <strong>「Excel 导入/盘点零售」</strong> 上传包含各分店销量、单价、月份的历史月报数据，瞬间生成大屏看板。
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <span className="text-emerald-600">5.</span> 📈 总部历史批发订单
                  </div>
                  <div className="pl-4 text-[11px] text-slate-400 leading-normal">
                    <strong>入口</strong>: <strong>「总部批发决策 (供销供货大屏)」</strong> 页面
                    <br />
                    <strong>说明</strong>: 通过 <strong>「Excel 导入批发」</strong> 上传批发交易数据。
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 text-emerald-950 rounded-lg text-[11px] leading-relaxed border border-emerald-100">
                  <strong>💡 贴心提醒：</strong>
                  所有上传的模板，都已经在导入弹窗中内置了<strong>「标准 Excel 模板下载」</strong>按钮，请下载后再填写以保证格式 100% 匹配。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
