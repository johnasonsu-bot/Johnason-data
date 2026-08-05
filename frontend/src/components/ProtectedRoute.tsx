import { Spin } from "antd";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasLicensedFeature } from "../app/licenseFeatures";
import { MODULE_ROUTE_PRIORITY, getFirstAccessiblePath, getRequiredAnyPermissionsForPath, getRequiredLicenseFeatureForPath, getRequiredPermissionForPath, hasAnyModulePermission, hasModulePermission } from "../app/permissions";
import { useAuth } from "../app/providers/AuthProvider";

export function ProtectedRoute() {
  const { isAuthenticated, licenseLoaded, licenseStatus, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!licenseLoaded) {
    return <Spin fullscreen tip="正在校验授权状态..." />;
  }

  const requiredFeature = getRequiredLicenseFeatureForPath(location.pathname);
  const allowedWithoutActivation = location.pathname === "/dashboard/system-license"
    || Boolean(requiredFeature && hasLicensedFeature(licenseStatus, requiredFeature));

  if (licenseStatus && !licenseStatus.isActivated && !allowedWithoutActivation) {
    return <Navigate to="/dashboard/system-license" replace state={{ from: location }} />;
  }

  const requiredAnyPermissions = getRequiredAnyPermissionsForPath(location.pathname);
  if (requiredAnyPermissions.length > 0 && !hasAnyModulePermission(user, requiredAnyPermissions)) {
    return <Navigate to={getFirstAccessiblePath(user)} replace />;
  }

  const requiredPermission = getRequiredPermissionForPath(location.pathname);
  if (requiredPermission && !hasModulePermission(user, requiredPermission)) {
    return <Navigate to={getFirstAccessiblePath(user)} replace />;
  }

  if (requiredFeature && !hasLicensedFeature(licenseStatus, requiredFeature)) {
    const licensedPath = MODULE_ROUTE_PRIORITY.find((item) =>
      hasModulePermission(user, item.permission) && hasLicensedFeature(licenseStatus, item.permission)
    )?.path;
    return <Navigate to={licensedPath || "/dashboard/system-license"} replace />;
  }

  return <Outlet />;
}
