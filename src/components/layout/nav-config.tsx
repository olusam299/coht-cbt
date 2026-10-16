import { ClipboardList, Building2, FileSpreadsheet, LayoutDashboard, MonitorPlay, Settings, ShieldAlert, UserCog, Users, Database, ListChecks, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
export interface NavItem { to:string; label:string; short:string; icon:LucideIcon; primary?:boolean }
export const ADMIN_NAV:NavItem[]=[
{to:"/admin",label:"Dashboard",short:"Home",icon:LayoutDashboard,primary:true},
{to:"/admin/monitor",label:"Live Paper",short:"Live",icon:MonitorPlay,primary:true},
{to:"/admin/attendance",label:"Attendance",short:"Roll",icon:ClipboardList,primary:true},
];
export const SUPERADMIN_NAV:NavItem[]=[
{to:"/superadmin",label:"Dashboard",short:"Home",icon:LayoutDashboard,primary:true},
{to:"/superadmin/monitor",label:"Monitor Papers",short:"Monitor",icon:MonitorPlay,primary:true},
{to:"/superadmin/students",label:"Students",short:"Students",icon:Users,primary:true},
{to:"/superadmin/otp",label:"OTP Desk",short:"OTP",icon:KeyRound},
{to:"/superadmin/academic",label:"Academic Structure",short:"Academic",icon:Building2},
{to:"/superadmin/papers",label:"Examinations",short:"Papers",icon:ClipboardList,primary:true},
{to:"/superadmin/question-bank",label:"Question Bank",short:"Questions",icon:ListChecks},
{to:"/superadmin/results",label:"Results & Reports",short:"Results",icon:FileSpreadsheet},
{to:"/superadmin/data",label:"Data Management",short:"Data",icon:Database},
{to:"/superadmin/security",label:"Security Logs",short:"Security",icon:ShieldAlert},
{to:"/superadmin/admins",label:"Admin Management",short:"Admins",icon:UserCog},
{to:"/superadmin/settings",label:"Settings",short:"Settings",icon:Settings},
];
