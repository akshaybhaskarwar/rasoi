import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Shield, Users, Home, Package, Languages, Calendar, 
  TrendingUp, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, ChevronDown, ChevronUp, Crown,
  BarChart3, Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminPage = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [apiUsage, setApiUsage] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [pendingTranslations, setPendingTranslations] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    stats: true,
    apiUsage: true,
    translations: false,
    festivals: false,
    users: false
  });

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [dashboardRes, usageRes, alertsRes] = await Promise.all([
        axios.get(`${API}/api/admin/dashboard`, { headers }),
        axios.get(`${API}/api/admin/api-usage?days=7`, { headers }),
        axios.get(`${API}/api/admin/api-usage/alerts`, { headers })
      ]);
      
      setDashboard(dashboardRes.data);
      setApiUsage(usageRes.data);
      setAlerts(alertsRes.data.alerts || []);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      if (error.response?.status === 403) {
        toast.error('Admin access required');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTranslations = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/api/admin/translations/pending`, { headers });
      setPendingTranslations(res.data.pending || []);
    } catch (error) {
      console.error('Error fetching translations:', error);
    }
  };

  useEffect(() => {
    if (token && user?.is_admin) {
      fetchDashboardData();
      fetchTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.is_admin]);

  // Redirect non-admin users
  if (user && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const handleApproveTranslation = async (translationId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/admin/translations/${translationId}/approve`, {}, { headers });
      toast.success('Translation approved');
      fetchTranslations();
    } catch (error) {
      toast.error('Failed to approve translation');
    }
  };

  const handleRejectTranslation = async (translationId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/admin/translations/${translationId}/reject`, {}, { headers });
      toast.success('Translation rejected');
      fetchTranslations();
    } catch (error) {
      toast.error('Failed to reject translation');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6" data-testid="admin-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage Rasoi-Sync Platform</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium text-amber-800">Active Alerts</h3>
                {alerts.map((alert, idx) => (
                  <p key={idx} className="text-sm text-amber-700">• {alert.message}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="space-y-4">
        <button 
          onClick={() => toggleSection('stats')}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Platform Statistics
          </h2>
          {expandedSections.stats ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {expandedSections.stats && dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-800">{dashboard.users?.total || 0}</p>
                    <p className="text-xs text-blue-600">Total Users</p>
                    {dashboard.users?.new_this_week > 0 && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        +{dashboard.users.new_this_week} this week
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Home className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-800">{dashboard.households?.total || 0}</p>
                    <p className="text-xs text-green-600">Households</p>
                    {dashboard.households?.new_this_week > 0 && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        +{dashboard.households.new_this_week} this week
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="text-2xl font-bold text-amber-800">{dashboard.inventory?.total_items || 0}</p>
                    <p className="text-xs text-amber-600">Inventory Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Languages className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-purple-800">{dashboard.translations?.total || 0}</p>
                    <p className="text-xs text-purple-600">Translations</p>
                    {dashboard.translations?.community_verified > 0 && (
                      <Badge className="mt-1 text-[10px] bg-yellow-500">
                        {dashboard.translations.community_verified} gold
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* API Usage Section */}
      <div className="space-y-4">
        <button 
          onClick={() => toggleSection('apiUsage')}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            API Quota Usage
          </h2>
          {expandedSections.apiUsage ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.apiUsage && apiUsage && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* YouTube Quota */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                  </div>
                  YouTube API
                </CardTitle>
                <CardDescription>Daily quota: 10,000 units</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used today</span>
                    <span className="font-medium">{apiUsage.quotas?.youtube?.used_today || 0} / 10,000</span>
                  </div>
                  <Progress 
                    value={(apiUsage.quotas?.youtube?.used_today || 0) / 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-gray-500">
                    {apiUsage.by_api?.youtube?.requests || 0} requests in last 7 days
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Translation Quota */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Languages className="w-5 h-5 text-blue-600" />
                  </div>
                  Translation API
                </CardTitle>
                <CardDescription>Daily quota: 500,000 characters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used today</span>
                    <span className="font-medium">{apiUsage.quotas?.translation?.used_today || 0} / 500,000</span>
                  </div>
                  <Progress 
                    value={(apiUsage.quotas?.translation?.used_today || 0) / 5000} 
                    className="h-2"
                  />
                  <p className="text-xs text-gray-500">
                    {apiUsage.by_api?.translation?.requests || 0} requests in last 7 days
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Top Households */}
            {apiUsage.top_households?.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top API Users (Households)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {apiUsage.top_households.slice(0, 5).map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{h.name}</span>
                        <Badge variant="outline">{h.total_units} units</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Translation Moderation */}
      <div className="space-y-4">
        <button 
          onClick={() => toggleSection('translations')}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Languages className="w-5 h-5 text-green-600" />
            Translation Moderation
            {pendingTranslations.length > 0 && (
              <Badge className="bg-orange-500">{pendingTranslations.length} pending</Badge>
            )}
          </h2>
          {expandedSections.translations ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.translations && (
          <Card>
            <CardContent className="p-4">
              {pendingTranslations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No translations pending moderation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTranslations.map((t) => (
                    <div key={t.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{t.source_text}</p>
                          <p className="text-sm text-blue-600 mt-1">→ {t.translated_text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t.verification_count || 0} users verified • {t.target_lang}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApproveTranslation(t.id)}
                            className="text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectTranslation(t.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming Festivals */}
      <div className="space-y-4">
        <button 
          onClick={() => toggleSection('festivals')}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-pink-600" />
            Festival Calendar
            {dashboard?.upcoming_festivals?.length > 0 && (
              <Badge variant="secondary">{dashboard.upcoming_festivals.length} upcoming</Badge>
            )}
          </h2>
          {expandedSections.festivals ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.festivals && (
          <Card>
            <CardContent className="p-4">
              {(!dashboard?.upcoming_festivals || dashboard.upcoming_festivals.length === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No upcoming festivals configured</p>
                  <Button variant="outline" className="mt-4" size="sm">
                    Add Festival
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.upcoming_festivals.map((f, idx) => (
                    <div key={idx} className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{f.name_en}</p>
                          {f.name_mr && <p className="text-sm text-gray-600">{f.name_mr}</p>}
                          <p className="text-xs text-gray-500 mt-1">{f.date} • {f.region}</p>
                        </div>
                        <Badge variant="outline" className="border-pink-300 text-pink-700">
                          {f.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {f.dadi_message && (
                        <p className="text-xs text-purple-600 mt-2 italic">&ldquo;{f.dadi_message}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Management */}
      <div className="space-y-4">
        <button 
          onClick={() => toggleSection('users')}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-600" />
            Admin Management
          </h2>
          {expandedSections.users ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expandedSections.users && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Grant admin privileges to users. Admins can access this dashboard and manage platform settings.
                </p>
                
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800 mb-3">
                    <strong>To make a user admin:</strong> Use the API endpoint or MongoDB directly.
                  </p>
                  <code className="text-xs bg-yellow-100 p-2 rounded block overflow-x-auto">
                    POST /api/admin/make-admin/&#123;user_id&#125;
                  </code>
                </div>

                <div className="text-sm text-gray-500">
                  <p>Current admin: <strong>{user?.email}</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
