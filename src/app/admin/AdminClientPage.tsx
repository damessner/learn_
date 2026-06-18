"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import {
  adminGetUsersAction,
  adminCreateUserAction,
  adminUpdateUserAction,
  adminDeleteUserAction,
  adminSetUserActiveAction,
  getConversationDetail,
} from "@/lib/actions/aloys";

interface UserListItem {
  id: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: Date;
  dailyLimit: number;
  dailyRemaining: number;
  classroomsJoined: Array<{
    classroom: {
      id: string;
      name: string;
    };
  }>;
}

interface ClassroomItem {
  id: string;
  name: string;
  joinCode: string;
}

interface ConversationItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    username: string;
  };
}

interface Message {
  id: string;
  role: string;
  content: string;
  type: string;
  metadataJson: string | null;
  createdAt: Date;
}

interface AdminClientPageProps {
  initialUsers: UserListItem[];
  classrooms: ClassroomItem[];
  initialConversations: ConversationItem[];
}

export function AdminClientPage({
  initialUsers,
  classrooms,
  initialConversations,
}: AdminClientPageProps) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers);
  const [conversations] = useState<ConversationItem[]>(initialConversations);
  const [activeTab, setActiveTab] = useState<"users" | "classrooms" | "dialogues">("users");

  // Create User State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);

  // Update Quotas / Password State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState(160);
  const [editPassword, setEditPassword] = useState("");
  const [editClassrooms, setEditClassrooms] = useState<string[]>([]);

  // Selected Socratic Log State
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConvDetail, setActiveConvDetail] = useState<{
    id: string;
    title: string;
    studentName: string;
    messages: Message[];
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel confirm state after 5 seconds
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // Reload user list
  const refreshUsers = async () => {
    try {
      const updated = await adminGetUsersAction();
      setUsers(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and Password are required.");
      return;
    }

    startTransition(async () => {
      try {
        await adminCreateUserAction(username.trim(), password.trim(), role, selectedClassrooms);
        setSuccess(`User "${username}" created successfully.`);
        setUsername("");
        setPassword("");
        setRole("STUDENT");
        setSelectedClassrooms([]);
        await refreshUsers();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create user");
      }
    });
  };

  // Handle Update User (Quotas, password, classrooms)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await adminUpdateUserAction(
          editingUserId,
          editPassword.trim() || undefined,
          undefined,
          editDailyLimit,
          editClassrooms
        );
        setSuccess("User updated successfully.");
        setEditingUserId(null);
        setEditPassword("");
        await refreshUsers();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update user");
      }
    });
  };

  // Handle Delete User (actual execution, called after confirmation)
  const handleDeleteUser = async (userId: string, name: string) => {
    setConfirmingDeleteId(null);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await adminDeleteUserAction(userId);
        setSuccess(`User "${name}" deleted.`);
        await refreshUsers();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to delete user");
      }
    });
  };

  // Initiate delete confirmation (first click)
  const handleDeleteClick = (userId: string) => {
    // Clear any existing timeout
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    setConfirmingDeleteId(userId);
    // Auto-cancel after 5 seconds
    confirmTimeoutRef.current = setTimeout(() => {
      setConfirmingDeleteId(null);
      confirmTimeoutRef.current = null;
    }, 5000);
  };

  // Cancel delete confirmation
  const handleCancelDelete = () => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
    setConfirmingDeleteId(null);
  };

  // View Socratic Conversation details
  const viewConversationLogs = async (id: string, studentName: string) => {
    setLoadingConv(true);
    setError(null);
    try {
      const detail = await getConversationDetail(id);
      setActiveConvDetail({
        id: detail.id,
        title: detail.title,
        studentName,
        messages: detail.messages.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      });
      setActiveConvId(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to retrieve conversation logs");
    } finally {
      setLoadingConv(false);
    }
  };

  const toggleClassroomSelect = (id: string, editing: boolean) => {
    if (editing) {
      setEditClassrooms((prev) =>
        prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
      );
    } else {
      setSelectedClassrooms((prev) =>
        prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0">
      {/* Page Header */}
      <div className="border border-black dark:border-white p-5 bg-white dark:bg-black/10 select-none flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold uppercase tracking-widest">
            ADMINISTRATOR CENTER
          </h1>
          <p className="text-[10px] font-mono text-neutral-400 mt-1 uppercase">
            School Founder AI &ldquo;Aloys&rdquo; Control Panel
          </p>
        </div>
        <div className="flex space-x-2">
          {(["users", "classrooms", "dialogues"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-mono text-[10px] uppercase tracking-wider py-1.5 px-4 border rounded-none cursor-pointer ${
                activeTab === tab
                  ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-bold"
                  : "bg-transparent border-neutral-300 dark:border-neutral-800 hover:border-black dark:hover:border-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-[#ff2a2e]/10 border border-[#ff2a2e] text-[#ff2a2e] font-mono text-[11px] p-3">
          [ERROR] {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-600 dark:text-green-400 font-mono text-[11px] p-3">
          [OK] {success}
        </div>
      )}

      {/* TAB 1: USERS */}
      {activeTab === "users" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-y-auto">
          {/* Create / Edit User Pane */}
          <div className="lg:col-span-1 border border-black dark:border-white p-5 bg-white dark:bg-black/10 h-fit space-y-6">
            {!editingUserId ? (
              <>
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a2e]">
                  {'// CREATE ACCOUNT'}
                </h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Username:
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. j.smith"
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Password:
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. password123"
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Account Role:
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                    >
                      <option value="STUDENT">STUDENT (AI Quotas Applied)</option>
                      <option value="TEACHER">TEACHER (Unlimited AI)</option>
                      <option value="ADMIN">ADMIN (Full Privileges)</option>
                    </select>
                  </div>

                  {role === "STUDENT" && (
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                        Map to Classes:
                      </label>
                      <div className="border border-neutral-200 dark:border-neutral-800 p-3 max-h-40 overflow-y-auto space-y-2">
                        {classrooms.length === 0 ? (
                          <span className="text-[10px] font-mono text-neutral-500 italic">
                            No classes created.
                          </span>
                        ) : (
                          classrooms.map((cls) => (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => toggleClassroomSelect(cls.id, false)}
                              className={`w-full text-left p-1.5 font-mono text-[10px] border transition flex items-center space-x-2 rounded-none ${
                                selectedClassrooms.includes(cls.id)
                                  ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                                  : "bg-transparent border-transparent hover:border-neutral-400"
                              }`}
                            >
                              <span>{selectedClassrooms.includes(cls.id) ? "[X]" : "[ ]"}</span>
                              <span>{cls.name} ({cls.joinCode})</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider py-3 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-40 cursor-pointer"
                  >
                    Create User Account
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a2e]">
                  {'// EDIT ACCOUNT'}
                </h2>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="font-mono text-xs">
                    Editing User: <span className="font-bold text-black dark:text-white">
                      {users.find((u) => u.id === editingUserId)?.username}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Reset Password (leave empty to keep current):
                    </label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                    />
                  </div>

                  {users.find((u) => u.id === editingUserId)?.role === "STUDENT" && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                          Daily Contingent Limit:
                        </label>
                        <input
                          type="number"
                          value={editDailyLimit}
                          onChange={(e) => setEditDailyLimit(parseInt(e.target.value) || 0)}
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                          Edit Class Mappings:
                        </label>
                        <div className="border border-neutral-200 dark:border-neutral-800 p-3 max-h-40 overflow-y-auto space-y-2">
                          {classrooms.map((cls) => (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => toggleClassroomSelect(cls.id, true)}
                              className={`w-full text-left p-1.5 font-mono text-[10px] border transition flex items-center space-x-2 rounded-none ${
                                editClassrooms.includes(cls.id)
                                  ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                                  : "bg-transparent border-transparent hover:border-neutral-400"
                              }`}
                            >
                              <span>{editClassrooms.includes(cls.id) ? "[X]" : "[ ]"}</span>
                              <span>{cls.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-40 cursor-pointer"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="w-full border border-neutral-300 dark:border-neutral-800 bg-transparent text-black dark:text-white font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-none hover:border-black dark:hover:border-white transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* User List Table */}
          <div className="lg:col-span-2 border border-black dark:border-white p-5 bg-white dark:bg-black/10 flex flex-col min-h-[400px]">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-4">
              {'// REGISTERED USER DATABASE'}
            </h2>
            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-black dark:border-white text-left text-neutral-400 text-[10px] tracking-wider uppercase">
                    <th className="pb-3 pr-2">Username</th>
                    <th className="pb-3 pr-2">Role</th>
                    <th className="pb-3 pr-2">Status</th>
                    <th className="pb-3 pr-2">Classes</th>
                    <th className="pb-3 pr-2">Daily Quota</th>
                    <th className="pb-3 pr-2">Window Quota</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-900">
                  {users.map((u) => {
                    const mappedClasses = u.classroomsJoined.map((cj) => cj.classroom.name).join(", ") || "-";
                    return (
                      <tr key={u.id} className={`hover:bg-neutral-50 dark:hover:bg-black/20 ${confirmingDeleteId === u.id ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                        <td className="py-3.5 pr-2 font-bold">{u.username}</td>
                        <td className="py-3.5 pr-2">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 border select-none ${
                              u.role === "ADMIN"
                                ? "text-[#ff2a2e] border-[#ff2a2e]/50"
                                : u.role === "TEACHER"
                                ? "text-blue-500 border-blue-500/50"
                                : "text-neutral-500 border-neutral-300 dark:border-neutral-800"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 border select-none ${
                              u.active
                                ? "text-green-600 border-green-500/50 dark:text-green-400 dark:border-green-500/50"
                                : "text-amber-600 border-amber-500/50 dark:text-amber-400 dark:border-amber-500/50"
                            }`}
                          >
                            {u.active ? "ACTIVE" : "PENDING"}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 max-w-[150px] truncate" title={mappedClasses}>
                          {mappedClasses}
                        </td>
                        <td className="py-3.5 pr-2">
                          {u.role === "STUDENT" ? `${u.dailyRemaining}/${u.dailyLimit}` : "Unlimited"}
                        </td>
                        <td className="py-3.5 pr-2">
                          {u.role === "STUDENT" ? "30 inp / 5 quiz per 45m" : "Unlimited"}
                        </td>
                        <td className="py-3.5 text-right space-x-2">
                          {confirmingDeleteId === u.id ? (
                            <>
                              <span className="text-[10px] font-mono text-[#ff2a2e] mr-1">
                                Delete user &lsquo;{u.username}&rsquo;? This cannot be undone.
                              </span>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                disabled={isPending}
                                className="text-[10px] uppercase tracking-wider text-white bg-[#ff2a2e] border border-[#ff2a2e] px-2 py-0.5 hover:bg-transparent hover:text-[#ff2a2e] transition disabled:opacity-40 cursor-pointer rounded-none"
                              >
                                Confirm Delete
                              </button>
                              <button
                                onClick={handleCancelDelete}
                                className="text-[10px] uppercase tracking-wider text-neutral-500 underline hover:text-black dark:hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={async () => {
                                  setError(null);
                                  setSuccess(null);
                                  try {
                                    await adminSetUserActiveAction(u.id, !u.active);
                                    setSuccess(`User "${u.username}" ${u.active ? "deactivated" : "activated"}.`);
                                    await refreshUsers();
                                  } catch (err: unknown) {
                                    setError(err instanceof Error ? err.message : "Failed to toggle user status");
                                  }
                                }}
                                disabled={isPending}
                                className="text-[10px] uppercase tracking-wider underline hover:no-underline cursor-pointer disabled:opacity-40"
                                style={{ color: u.active ? "#ff2a2e" : "#16a34a" }}
                              >
                                {u.active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setEditDailyLimit(u.dailyLimit);
                                  setEditClassrooms(u.classroomsJoined.map((cj) => cj.classroom.id));
                                  setEditPassword("");
                                  setError(null);
                                  setSuccess(null);
                                }}
                                className="text-[10px] uppercase tracking-wider text-black dark:text-white underline hover:no-underline cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(u.id)}
                                className="text-[10px] uppercase tracking-wider text-[#ff2a2e] underline hover:no-underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASSROOMS */}
      {activeTab === "classrooms" && (
        <div className="border border-black dark:border-white p-5 bg-white dark:bg-black/10 flex-1 overflow-y-auto">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-4">
            {'// ACTIVE CLASSROOM REGISTER'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {classrooms.length === 0 ? (
              <span className="font-mono text-xs text-neutral-500 italic">
                No classrooms registered in the database.
              </span>
            ) : (
              classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="border border-neutral-300 dark:border-neutral-800 p-5 rounded-none font-mono text-xs bg-white dark:bg-black/30 space-y-2 select-none"
                >
                  <div className="text-[10px] text-[#ff2a2e] font-bold uppercase">
                    Class ID: {cls.id.substring(0, 8)}...
                  </div>
                  <div className="text-sm font-bold text-black dark:text-white">{cls.name}</div>
                  <div className="border-t border-neutral-200 dark:border-neutral-900 pt-2 flex justify-between items-center text-[10px] text-neutral-400 uppercase">
                    <span>Join Code:</span>
                    <span className="font-bold text-black dark:text-white tracking-widest bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5">
                      {cls.joinCode}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DIALOGUES */}
      {activeTab === "dialogues" && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0 overflow-hidden">
          {/* Conversation list */}
          <div className="md:col-span-1 border border-black dark:border-white p-5 bg-white dark:bg-black/10 flex flex-col min-h-0">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-3 select-none">
              {'// ACTIVE DIALOGUE ENTRIES'}
            </h2>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {conversations.length === 0 ? (
                <span className="text-[10px] font-mono text-neutral-500 italic block select-none">
                  No Socratic interactions found in logs.
                </span>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeConvId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => viewConversationLogs(c.id, c.student.username)}
                      className={`w-full text-left p-3 font-mono text-[11px] border border-neutral-200 dark:border-neutral-800 transition select-none flex flex-col space-y-1 rounded-none cursor-pointer ${
                        isActive
                          ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white font-bold"
                          : "hover:border-neutral-400 dark:hover:border-neutral-700 bg-transparent"
                      }`}
                    >
                      <span className="truncate">{c.title}</span>
                      <div className="flex justify-between items-center text-[9px] text-neutral-400">
                        <span>PUPIL: {c.student.username}</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Dialogue transcript display */}
          <div className="md:col-span-2 border border-black dark:border-white flex flex-col bg-white dark:bg-black/10 min-h-0">
            <div className="border-b border-black dark:border-white px-5 py-3 flex items-center justify-between select-none">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                {activeConvDetail
                  ? `LOG: ${activeConvDetail.studentName} / ${activeConvDetail.title}`
                  : "TRANSCRIPT VIEWER"}
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                {activeConvDetail ? "INSPECTION ACTIVE" : "STANDBY"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingConv ? (
                <div className="h-full flex items-center justify-center font-mono text-xs text-neutral-500 animate-pulse">
                  DECRYPTING TRANSACTION LOG...
                </div>
              ) : !activeConvDetail ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 select-none">
                  <span className="text-2xl">📋</span>
                  <p className="font-mono text-xs text-neutral-400 max-w-xs leading-relaxed">
                    Select a dialogue entry from the left panel to inspect the full transcript history with Dr. Aloys.
                  </p>
                </div>
              ) : (
                activeConvDetail.messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center space-x-2 font-mono text-[9px] text-neutral-400 select-none">
                        <span>{isUser ? "// STUDENT" : "// DR. ALOYS"}</span>
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>

                      {m.type === "CHAT" && (
                        <div className="font-mono text-xs p-4 rounded-none leading-relaxed border bg-white dark:bg-black/50 border-neutral-300 dark:border-neutral-800 mr-6 text-neutral-700 dark:text-neutral-300">
                          {m.content}
                        </div>
                      )}

                      {m.type === "LEARN_TEXT" && (
                        <div className="bg-white dark:bg-black/50 border border-neutral-300 dark:border-neutral-800 p-5 mr-6 rounded-none space-y-3 font-mono text-xs leading-relaxed text-black dark:text-white">
                          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                            <span>Report / Reading Material</span>
                          </div>
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>
                      )}

                      {m.type === "LEARN_QUESTIONS" && (
                        <div className="bg-white dark:bg-black/50 border border-neutral-300 dark:border-neutral-800 p-5 mr-6 rounded-none space-y-5 font-mono text-xs text-black dark:text-white">
                          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                            <span>Comprehension Check Suite</span>
                          </div>
                          {(() => {
                            const metadata = JSON.parse(m.metadataJson || "{}");
                            const questions = metadata.questions as Array<{
                              question: string;
                              options: string[];
                              correctIndex: number;
                            }>;

                            if (!questions) return null;

                            return (
                              <div className="space-y-6">
                                {questions.map((q, qIdx) => (
                                  <div key={qIdx} className="space-y-2">
                                    <p className="font-bold">
                                      {qIdx + 1}. {q.question}
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 pl-2">
                                      {q.options.map((opt, oIdx) => {
                                        const isCorrect = q.correctIndex === oIdx;
                                        return (
                                          <div
                                            key={oIdx}
                                            className={`p-2.5 font-mono text-[11px] border flex items-center space-x-3 rounded-none ${
                                              isCorrect
                                                ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400"
                                                : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-500"
                                            }`}
                                          >
                                            <span className="font-mono text-[9px] uppercase tracking-widest select-none">
                                              {isCorrect ? "[CORRECT]" : "[ ]"}
                                            </span>
                                            <span>{opt}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {m.type === "LEARN_ANSWERS" && (
                        <div className="bg-white dark:bg-black/50 border border-[#ff2a2e]/50 p-5 mr-6 rounded-none space-y-4 font-mono text-xs text-black dark:text-white">
                          <div className="border-b border-[#ff2a2e]/30 pb-2 mb-2 flex justify-between items-center text-[10px] text-[#ff2a2e] tracking-wider uppercase select-none">
                            <span>Pupil Assessment Assessment Log</span>
                          </div>
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
