import { useState } from 'react';
import { Home, Users, ChevronDown, Plus, LogOut, Settings, Copy, Check, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const HouseholdSwitcher = () => {
  const { 
    user, 
    households, 
    activeHousehold, 
    switchHousehold, 
    createHousehold, 
    joinHousehold,
    removeMember,
    deleteHousehold,
    logout 
  } = useAuth();
  
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create, join, members
  const [loading, setLoading] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [kitchenCode, setKitchenCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showDeleteKitchenConfirm, setShowDeleteKitchenConfirm] = useState(false);

  if (!user) return null;

  const handleSwitch = async (householdId) => {
    if (householdId === activeHousehold?.id) return;
    
    const result = await switchHousehold(householdId);
    if (result.success) {
      toast.success('Switched kitchen');
      window.location.reload(); // Reload to fetch new data
    } else {
      toast.error(result.error);
    }
  };

  const handleCreate = async () => {
    if (!householdName.trim()) {
      toast.error('Please enter a kitchen name');
      return;
    }
    
    setLoading(true);
    const result = await createHousehold(householdName);
    
    if (result.success) {
      toast.success(`Kitchen created! Code: ${result.data.kitchen_code}`);
      setShowDialog(false);
      setHouseholdName('');
      window.location.reload();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!kitchenCode.trim() || kitchenCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    const result = await joinHousehold(kitchenCode);
    
    if (result.success) {
      toast.success(result.data.message);
      setShowDialog(false);
      setKitchenCode('');
      window.location.reload();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const copyKitchenCode = async () => {
    if (!activeHousehold?.kitchen_code) return;
    
    const code = activeHousehold.kitchen_code;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCodeCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy. Please copy manually: ' + code);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !activeHousehold) return;
    
    setLoading(true);
    const result = await removeMember(activeHousehold.id, memberToRemove.user_id);
    
    if (result.success) {
      toast.success(result.data.message || `${memberToRemove.name} removed`);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      window.location.reload();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const confirmRemoveMember = (member) => {
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const handleDeleteKitchen = async () => {
    if (!activeHousehold) return;
    
    setLoading(true);
    const result = await deleteHousehold(activeHousehold.id);
    
    if (result.success) {
      toast.success(result.data.message || 'Kitchen deleted');
      setShowDeleteKitchenConfirm(false);
      setShowDialog(false);
      window.location.reload();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  // Check if owner can delete kitchen (only when they are the only member)
  const canDeleteKitchen = activeHousehold?.is_owner && activeHousehold?.member_count === 1;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 h-9 px-3 border-orange-200 bg-orange-50 hover:bg-orange-100"
            data-testid="household-switcher"
          >
            <Home className="w-4 h-4 text-orange-600" />
            <span className="max-w-[120px] truncate text-sm font-medium">
              {activeHousehold?.name || 'No Kitchen'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>My Kitchens</span>
            <Badge variant="outline" className="text-xs">
              {households.length}/4
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {households.map((h) => (
            <DropdownMenuItem
              key={h.id}
              onClick={() => handleSwitch(h.id)}
              className={`flex items-center justify-between cursor-pointer ${
                h.id === activeHousehold?.id ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Home className={`w-4 h-4 ${h.id === activeHousehold?.id ? 'text-orange-600' : 'text-gray-400'}`} />
                <span className="truncate">{h.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {h.is_owner && (
                  <Badge variant="outline" className="text-[10px] px-1">Owner</Badge>
                )}
                <Badge variant="secondary" className="text-[10px] px-1">
                  <Users className="w-3 h-3 mr-0.5" />
                  {h.member_count}
                </Badge>
              </div>
            </DropdownMenuItem>
          ))}
          
          {households.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-gray-500">
              No kitchens yet
            </div>
          )}
          
          <DropdownMenuSeparator />
          
          {activeHousehold && (
            <DropdownMenuItem
              onClick={() => {
                setDialogMode('members');
                setShowDialog(true);
              }}
              className="cursor-pointer"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Family Member
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem
            onClick={() => {
              setDialogMode('create');
              setShowDialog(true);
            }}
            className="cursor-pointer"
            disabled={households.length >= 4}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Kitchen
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => {
              setDialogMode('join');
              setShowDialog(true);
            }}
            className="cursor-pointer"
            disabled={households.length >= 4}
          >
            <Users className="w-4 h-4 mr-2" />
            Join Kitchen
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog for create/join/members */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          {dialogMode === 'create' && (
            <>
              <DialogHeader>
                <DialogTitle>Create New Kitchen</DialogTitle>
                <DialogDescription>
                  Create a digital kitchen and invite family members
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Kitchen Name</Label>
                  <Input
                    placeholder="e.g., Sharma Family Kitchen"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleCreate} 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Kitchen'}
                </Button>
              </div>
            </>
          )}
          
          {dialogMode === 'join' && (
            <>
              <DialogHeader>
                <DialogTitle>Join a Kitchen</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code shared by your family member
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Kitchen Code</Label>
                  <Input
                    placeholder="ABC123"
                    value={kitchenCode}
                    onChange={(e) => setKitchenCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-xl tracking-widest font-mono"
                  />
                </div>
                <Button 
                  onClick={handleJoin} 
                  className="w-full"
                  disabled={loading || kitchenCode.length !== 6}
                >
                  {loading ? 'Joining...' : 'Join Kitchen'}
                </Button>
              </div>
            </>
          )}
          
          {dialogMode === 'members' && activeHousehold && (
            <>
              <DialogHeader>
                <DialogTitle>Invite Family Members</DialogTitle>
                <DialogDescription>
                  Share this code with family members to join &ldquo;{activeHousehold.name}&rdquo;
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600 mb-2">Kitchen Code</p>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeHousehold.kitchen_code}
                      onClick={(e) => e.target.select()}
                      className="text-3xl font-mono font-bold tracking-widest text-orange-600 bg-transparent border-none text-center w-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-300 rounded"
                      title="Click to select code"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyKitchenCode}
                      className="ml-2"
                      title="Copy to clipboard"
                    >
                      {codeCopied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click code to select, then Ctrl+C to copy</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Current Members ({activeHousehold.member_count}/4)</Label>
                  <div className="space-y-2">
                    {activeHousehold.members?.map((member, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{member.name}</span>
                          <Badge variant={member.role === 'owner' ? 'default' : 'outline'} className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                        {/* Show delete button for owner to remove non-owner members */}
                        {activeHousehold.is_owner && member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmRemoveMember(member)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title={`Remove ${member.name}`}
                            data-testid={`remove-member-${member.user_id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for removing member */}
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from &ldquo;{activeHousehold?.name}&rdquo;? 
              They will lose access to this kitchen&apos;s inventory, shopping list, and meal plans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default HouseholdSwitcher;
