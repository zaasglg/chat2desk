import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2 } from 'lucide-react';
import { type User } from '@/types';
import { useToast } from '@/components/ui/toast';

interface Props {
  groupId: number | null;
  groupName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function GroupMembersModal({ groupId, groupName, open, onOpenChange, onSaved }: Props) {
  const [members, setMembers] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && groupId) {
      fetchMembers();
      fetchUsers();
    }
    if (!open) {
      setMembers([]);
      setUsers([]);
      setSelectedUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId]);

  const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

  const fetchMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/operator-groups/${groupId}/operators`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const toast = useToast();

  const availableUsers = users.filter((u) => !members.some((m) => m.id === u.id));

  const addMember = async () => {
    if (!groupId || !selectedUserId) return;
    try {
      const res = await fetch(`/api/operator-groups/${groupId}/operators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ user_id: selectedUserId, is_supervisor: false }),
      });
      if (res.ok) {
        toast.success('Участник добавлен');
        fetchMembers();
        setSelectedUserId(null);
        onSaved?.();
      } else {
        const txt = await res.text();
        console.error('Add member failed', txt);
        toast.error('Не удалось добавить участника');
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при добавлении');
    }
  };

  const removeMember = async (userId: number) => {
    if (!groupId) return;
    if (!confirm('Удалить участника из группы?')) return;
    try {
      const res = await fetch(`/api/operator-groups/${groupId}/operators/${userId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': csrfToken() },
      });
      if (res.ok) {
        toast.success('Участник удалён');
        fetchMembers();
        onSaved?.();
      } else {
        toast.error('Не удалось удалить участника');
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при удалении');
    }
  };

  const toggleSupervisor = async (userId: number, current: boolean) => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/operator-groups/${groupId}/operators/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken() },
        body: JSON.stringify({ is_supervisor: !current }),
      });
      if (res.ok) {
        fetchMembers();
        onSaved?.();
      } else {
        toast.error('Не удалось обновить роль');
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при обновлении роли');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Участники группы {groupName ? `— ${groupName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Добавить пользователя</Label>
            <div className="flex gap-2 mt-2">
              <Select
                value={selectedUserId ? String(selectedUserId) : ''}
                onValueChange={(v) => setSelectedUserId(v ? parseInt(v) : null)}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addMember} disabled={!selectedUserId}>Добавить</Button>
            </div>
          </div>

          <div>
            <Label>Текущие участники</Label>
            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-2">
              {loading && <div className="text-sm text-muted-foreground">Загрузка...</div>}
              {!loading && members.length === 0 && <div className="text-sm text-muted-foreground">Нет участников</div>}
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border p-2 rounded">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar} />
                      <AvatarFallback>{m.name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={m.is_supervisor ? 'default' : 'outline'} onClick={() => toggleSupervisor(m.id, !!m.is_supervisor)}>
                      {m.is_supervisor ? 'Супервайзер' : 'Сделать супервайзером'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
