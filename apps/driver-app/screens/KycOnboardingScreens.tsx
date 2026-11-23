import React, { useState } from 'react';
import {
  BadgeCheck,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  FileUp,
  Lock,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { PhotoActionButtons } from '../components/PhotoCaptureControl';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import type { DocumentType, VehicleCategory } from '../contracts/types';
import {
  validateAdultDob,
  validateEmail,
  validateIndianPhone,
  validateVehicleRegNumber,
  validateVehicleYear,
} from '../contracts/validators';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

export const PersonalDetailsScreen: React.FC = () => {
  const {
    backendConfigured,
    onboardingDraft,
    updateDraft,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingDraft.fullName.trim() || !onboardingDraft.city.trim()) {
      setFeedback({
        type: 'error',
        title: 'Missing Required Fields',
        message: 'Enter your full legal name and operating city.',
      });
      return;
    }

    const phoneRes = validateIndianPhone(onboardingDraft.phone);
    if (!phoneRes.valid) {
      setFeedback({
        type: 'error',
        title: 'Invalid Phone Number',
        message: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      });
      return;
    }

    if (onboardingDraft.email.trim() && !validateEmail(onboardingDraft.email)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Email Address',
        message: 'Enter a valid email address or leave the field blank.',
      });
      return;
    }

    if (onboardingDraft.dateOfBirth && !validateAdultDob(onboardingDraft.dateOfBirth)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Date of Birth',
        message: 'Driver partners must be at least 18 years old.',
      });
      return;
    }

    if (
      onboardingDraft.emergencyContactPhone.trim() &&
      !validateIndianPhone(onboardingDraft.emergencyContactPhone).valid
    ) {
      setFeedback({
        type: 'error',
        title: 'Invalid Emergency Contact Phone',
        message: 'Enter a valid 10-digit Indian mobile number for your emergency contact.',
      });
      return;
    }

    setSaving(true);
    const res = await driverBackendService.driver.upsertProfile({
      full_name: onboardingDraft.fullName.trim(),
      phone: phoneRes.normalized,
      email: onboardingDraft.email.trim() || undefined,
      city: onboardingDraft.city.trim(),
      date_of_birth: onboardingDraft.dateOfBirth,
      emergency_contact_name: onboardingDraft.emergencyContactName.trim(),
      emergency_contact_phone: onboardingDraft.emergencyContactPhone.trim(),
    });
    setSaving(false);

    if (!res.ok) {
      setFeedback({
        type: res.error?.code === 'UNAUTHENTICATED' ? 'info' : 'error',
        title: res.error?.code === 'UNAUTHENTICATED' ? 'Sign In Required' : 'Profile Save Failed',
        message: res.error?.message || 'Sign in with Google or OTP first to save profile to Firestore.',
      });
      return;
    }

    await refreshDriverWorkspace();
    navigate('vehicle_selection');
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Personal Details"
        subtitle="Matches government ID and emergency contact records"
      />

      {!backendConfigured && (
        <StateNotice
          variant="unconfigured"
          title="Firebase Sync Inactive"
          description="Verify firebase-applet-config.json to persist driver details to Cloud Firestore."
        />
      )}

      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Full Legal Name</label>
          <input
            type="text"
            placeholder="As printed on Driving License"
            value={onboardingDraft.fullName}
            onChange={(e) => updateDraft({ fullName: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Primary Mobile Number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={onboardingDraft.phone}
            onChange={(e) =>
              updateDraft({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
            }
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Operating City</label>
          <input
            type="text"
            placeholder="e.g. Bengaluru, Hyderabad, Delhi"
            value={onboardingDraft.city}
            onChange={(e) => updateDraft({ city: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Date of Birth</label>
          <input
            type="date"
            value={onboardingDraft.dateOfBirth}
            onChange={(e) => updateDraft({ dateOfBirth: e.target.value })}
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Email (Optional)</label>
          <input
            type="email"
            placeholder="partner@example.com"
            value={onboardingDraft.email}
            onChange={(e) => updateDraft({ email: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Emergency Contact Name</label>
          <input
            type="text"
            placeholder="Family member or trusted contact"
            value={onboardingDraft.emergencyContactName}
            onChange={(e) => updateDraft({ emergencyContactName: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Emergency Contact Phone</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit emergency number"
            value={onboardingDraft.emergencyContactPhone}
            onChange={(e) =>
              updateDraft({
                emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10),
              })
            }
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <PrimaryButton type="submit" variant="brand" disabled={saving}>
            {saving ? 'Saving…' : 'Save & Select Vehicle'}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            variant="outline"
            onClick={() => navigate('vehicle_selection')}
          >
            Continue to Vehicle Selection
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};

const VEHICLE_CATEGORIES: {
  id: VehicleCategory;
  title: string;
  subtitle: string;
  requirements: string;
}[] = [
  {
    id: 'bike',
    title: 'Bike Taxi Partner',
    subtitle: 'Two-wheeler rapid city commutes',
    requirements: 'Valid 2W Driving License · Helmet · Commercial/White RC per state rules',
  },
  {
    id: 'auto',
    title: 'Auto Rickshaw Partner',
    subtitle: 'Three-wheeler short & mid-range trips',
    requirements: '3W Commercial Badge · Permit · Valid Fitness & Insurance',
  },
  {
    id: 'cab',
    title: 'Cab Partner (Hatch / Sedan / SUV)',
    subtitle: 'Four-wheeler city & airport rides',
    requirements: 'Yellow Board Commercial Permit · LMV-TR License · Comprehensive Insurance',
  },
];

export const VehicleSelectionScreen: React.FC = () => {
  const { onboardingDraft, updateDraft, navigate } = useDriverApp();

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Vehicle Selection"
        subtitle="Select the ride category you are registering to drive"
      />

      <div className="grid grid-cols-1 gap-3.5">
        {VEHICLE_CATEGORIES.map((cat) => {
          const selected = onboardingDraft.vehicleCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => updateDraft({ vehicleCategory: cat.id })}
              className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition-all ${
                selected
                  ? 'border-[#1E1E1E] bg-[#F5C518]/15 ring-2 ring-[#F5C518] dark:border-[#F5C518] dark:bg-[#F5C518]/10'
                  : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-[#14161A]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E1E1E] text-[#F5C518]">
                    {cat.id === 'bike' ? (
                      <Bike className="h-5 w-5" />
                    ) : cat.id === 'auto' ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <Car className="h-5 w-5" />
                    )}
                  </span>
                  {selected && (
                    <span className="text-xs font-bold text-[#1E1E1E] dark:text-[#F5C518]">
                      Selected
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{cat.title}</h3>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  {cat.subtitle}
                </p>
              </div>
              <p className="mt-4 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                {cat.requirements}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <PrimaryButton variant="brand" onClick={() => navigate('vehicle_details')}>
          Enter Vehicle Details
        </PrimaryButton>
      </div>
    </div>
  );
};

export const VehicleDetailsScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    onboardingDraft,
    updateDraft,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateVehicleRegNumber(onboardingDraft.registrationNumber)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Registration Number',
        message: 'Enter a valid Indian registration number (for example KA01AB1234).',
      });
      return;
    }

    if (!onboardingDraft.vehicleMake.trim() || !onboardingDraft.vehicleModel.trim()) {
      setFeedback({
        type: 'error',
        title: 'Vehicle Make & Model Required',
        message: 'Enter your vehicle manufacturer and model name.',
      });
      return;
    }

    if (!validateVehicleYear(onboardingDraft.vehicleYear)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Model Year',
        message: `Enter a valid vehicle year between 1995 and ${new Date().getFullYear() + 1}.`,
      });
      return;
    }

    if (!backendConfigured || !driverProfile) {
      setFeedback({
        type: 'info',
        title: 'Sign-In Required to Save Vehicle',
        message:
          'Your vehicle details are saved in the form draft. Sign in with Google or OTP to sync them to Firestore.',
      });
      return;
    }

    setSaving(true);
    const res = await driverBackendService.vehicle.upsertVehicle(driverProfile.driver_id, {
      category: onboardingDraft.vehicleCategory,
      make: onboardingDraft.vehicleMake.trim(),
      model: onboardingDraft.vehicleModel.trim(),
      year: Number(onboardingDraft.vehicleYear) || new Date().getFullYear(),
      color: onboardingDraft.vehicleColor.trim() || 'White',
      registration_number: onboardingDraft.registrationNumber.trim().toUpperCase(),
      permit_number: onboardingDraft.permitNumber.trim() || undefined,
      insurance_expiry: onboardingDraft.insuranceExpiry,
      rc_expiry: onboardingDraft.rcExpiry,
    });
    setSaving(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Vehicle Save Failed',
        message: res.error?.message || 'Unable to save vehicle record.',
      });
      return;
    }

    await refreshDriverWorkspace();
    navigate('document_upload');
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Vehicle Details"
        subtitle={`Registering category: ${onboardingDraft.vehicleCategory.toUpperCase()}`}
      />

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Registration Number</label>
          <input
            type="text"
            placeholder="KA01AB1234"
            value={onboardingDraft.registrationNumber}
            onChange={(e) => updateDraft({ registrationNumber: e.target.value.toUpperCase() })}
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm uppercase outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Make / Manufacturer</label>
          <input
            type="text"
            placeholder="e.g. Maruti Suzuki, Bajaj, Honda"
            value={onboardingDraft.vehicleMake}
            onChange={(e) => updateDraft({ vehicleMake: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Model</label>
          <input
            type="text"
            placeholder="e.g. Dzire, RE Compact, Activa"
            value={onboardingDraft.vehicleModel}
            onChange={(e) => updateDraft({ vehicleModel: e.target.value })}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Model Year &amp; Color</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="2023"
              value={onboardingDraft.vehicleYear}
              onChange={(e) => updateDraft({ vehicleYear: e.target.value })}
              className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
            />
            <input
              type="text"
              placeholder="Color"
              value={onboardingDraft.vehicleColor}
              onChange={(e) => updateDraft({ vehicleColor: e.target.value })}
              className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Insurance Expiry</label>
          <input
            type="date"
            value={onboardingDraft.insuranceExpiry}
            onChange={(e) => updateDraft({ insuranceExpiry: e.target.value })}
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">RC Validity Expiry</label>
          <input
            type="date"
            value={onboardingDraft.rcExpiry}
            onChange={(e) => updateDraft({ rcExpiry: e.target.value })}
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <PrimaryButton type="submit" variant="brand" disabled={saving}>
            {saving ? 'Saving…' : 'Save & Upload Documents'}
          </PrimaryButton>
          <PrimaryButton type="button" variant="outline" onClick={() => navigate('document_upload')}>
            Go to Document Upload
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};

export const ALL_KYC_DOCUMENTS: {
  type: DocumentType;
  group: 'driver' | 'vehicle';
  title: string;
  hint: string;
}[] = [
  {
    type: 'driver_selfie',
    group: 'driver',
    title: 'Driver Live Photo / Selfie',
    hint: 'Clear unmasked face photo (syncs to header & Admin KYC)',
  },
  {
    type: 'driving_license',
    group: 'driver',
    title: 'Driving License (Front & Back)',
    hint: 'Valid commercial / LMV-TR / 2W license',
  },
  {
    type: 'aadhaar_or_national_id',
    group: 'driver',
    title: 'Aadhaar / Government Photo ID',
    hint: 'Aadhaar Card, Voter ID, or Passport',
  },
  {
    type: 'pan_card',
    group: 'driver',
    title: 'PAN Card',
    hint: 'Required for bank payout & TDS compliance',
  },
  {
    type: 'vehicle_rc',
    group: 'vehicle',
    title: 'Vehicle Registration Certificate (RC)',
    hint: 'Must match entered vehicle registration plate',
  },
  {
    type: 'vehicle_insurance',
    group: 'vehicle',
    title: 'Active Vehicle Insurance',
    hint: 'Valid third-party or comprehensive motor policy',
  },
  {
    type: 'vehicle_permit',
    group: 'vehicle',
    title: 'Commercial Permit / Fitness Certificate',
    hint: 'State transport permit & fitness certificate',
  },
  {
    type: 'vehicle_puc',
    group: 'vehicle',
    title: 'Pollution (PUC) Certificate',
    hint: 'Valid emission compliance certificate',
  },
  {
    type: 'vehicle_photo',
    group: 'vehicle',
    title: 'Vehicle Photo (With Number Plate)',
    hint: 'Front/angled clear photo showing license plate',
  },
];

export const DocumentUploadScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    documents,
    onboardingDraft,
    stageDocumentFile,
    uploadOrSetProfilePhoto,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [uploadingDoc, setUploadingDoc] = useState<DocumentType | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleFilePick = async (docType: DocumentType, file: File) => {
    stageDocumentFile(docType, file);

    if (docType === 'driver_selfie' && file.type.startsWith('image/')) {
      await uploadOrSetProfilePhoto(file);
    }

    if (!backendConfigured || !driverProfile) {
      setFeedback({
        type: 'info',
        title: 'Document Staged Locally',
        message: `${file.name} attached. Sign in with Google or Phone OTP so it compresses & saves directly to Firestore for Super Admin.`,
      });
      return;
    }

    setUploadingDoc(docType);
    const res = await driverBackendService.kyc.uploadDocument(driverProfile.driver_id, docType, file);
    setUploadingDoc(null);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Upload Failed',
        message: res.error?.message || 'Unable to compress & upload document.',
      });
      return;
    }
    setFeedback({
      type: 'success',
      title: 'Saved to Super Admin KYC Queue',
      message: `${file.name} compressed cleanly & synced to Cloud Firestore.`,
    });
  };

  const handleSubmitForReview = async () => {
    if (!driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Sign-In Required',
        message: 'Sign in with Google or Phone OTP to submit KYC documents for Super Admin review.',
      });
      return;
    }
    setSubmittingReview(true);
    const res = await driverBackendService.kyc.submitForApproval(driverProfile.driver_id);
    setSubmittingReview(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Submission Failed',
        message: res.error?.message || 'Could not submit KYC.',
      });
      return;
    }
    await refreshDriverWorkspace();
    navigate('kyc_pending');
  };

  const driverDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'driver');
  const vehicleDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'vehicle');

  const renderDocCard = (doc: (typeof ALL_KYC_DOCUMENTS)[number]) => {
    const remote = documents.find((d) => d.document_type === doc.type);
    const localName = onboardingDraft.selectedFiles[doc.type];
    const previewSrc =
      remote?.file_url && remote.file_url.startsWith('data:image/') ? remote.file_url : null;
    return (
      <div
        key={doc.type}
        className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{doc.title}</h3>
            <span
              className={`shrink-0 text-xs font-semibold ${
                remote?.status === 'verified'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : remote?.status === 'rejected'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {remote
                ? (remote.status || 'pending_review').replace('_', ' ')
                : localName
                  ? 'Staged (Local)'
                  : 'Pending'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{doc.hint}</p>
          {(remote?.file_name || localName) && (
            <p className="font-mono-num mt-2 truncate text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {remote?.file_name || localName}
            </p>
          )}
          {previewSrc && (
            <img
              src={previewSrc}
              alt={doc.title}
              className="mt-2.5 h-24 w-36 rounded-xl border border-neutral-200 object-cover dark:border-neutral-700"
            />
          )}
        </div>

        <div className="mt-4">
          <PhotoActionButtons
            onSelectFile={(file) => void handleFilePick(doc.type, file)}
            facingMode={doc.type === 'driver_selfie' ? 'user' : 'environment'}
            accept="image/*,.pdf"
            cameraTitle={`Click Photo: ${doc.title}`}
            busy={uploadingDoc === doc.type}
            cameraLabel="Click Photo"
            uploadLabel="Upload"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Driver & Vehicle Document Upload"
        subtitle="Zero paid storage buckets — photos compress automatically on device & sync straight to Super Admin Firestore"
      />

      <section className="space-y-3">
        <h2 className="font-display text-sm font-bold tracking-wide text-neutral-600 uppercase dark:text-neutral-300">
          Driver Identity &amp; License Documents ({driverDocs.length})
        </h2>
        <div className="grid grid-cols-1 gap-3">{driverDocs.map(renderDocCard)}</div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-bold tracking-wide text-neutral-600 uppercase dark:text-neutral-300">
          Vehicle Authentication Documents ({vehicleDocs.length})
        </h2>
        <div className="grid grid-cols-1 gap-3">{vehicleDocs.map(renderDocCard)}</div>
      </section>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton
          variant="brand"
          disabled={submittingReview}
          onClick={() => void handleSubmitForReview()}
        >
          <FileUp className="h-4 w-4" />
          {submittingReview ? 'Submitting Docs…' : 'Submit All Docs for Admin Approval'}
        </PrimaryButton>
        <PrimaryButton variant="outline" onClick={() => navigate('kyc_pending')}>
          View Approval &amp; Rider ID Status
        </PrimaryButton>
      </div>
    </div>
  );
};

export const KycPendingScreen: React.FC = () => {
  const { backendConfigured, driverProfile, vehicle, onlineEligibility, refreshDriverWorkspace, navigate } =
    useDriverApp();

  const gates = [
    { label: 'Profile Completed', ok: Boolean(driverProfile?.profile_completed) },
    { label: 'Driver & Vehicle Documents Uploaded', ok: Boolean(driverProfile?.documents_uploaded) },
    {
      label: 'Vehicle Verification Complete',
      ok: Boolean(driverProfile?.vehicle_verified && vehicle?.verification_status === 'verified'),
    },
    { label: 'Super Admin Approval Granted', ok: Boolean(driverProfile?.admin_approved) },
    {
      label: 'Captain Driver ID Provisioned & Account Active',
      ok: Boolean(
        driverProfile?.account_status === 'active' &&
          (driverProfile?.driverCode || driverProfile?.short_id || driverProfile?.partner_rider_id)
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Admin Approval & Rider ID Status"
        subtitle="Real-time verification gate synced from SHINE CAB Super Admin Panel"
        action={
          <PrimaryButton variant="outline" onClick={() => void refreshDriverWorkspace()}>
            Refresh Live Status
          </PrimaryButton>
        }
      />

      {!backendConfigured || !driverProfile ? (
        <StateNotice
          variant="unconfigured"
          title="Sign In to View Admin Approval Status"
          description="SHINE CAPTAIN syncs your Partner Rider ID and KYC decision directly from Cloud Firestore."
          actionLabel="Open Partner Login"
          onAction={() => navigate('login_otp')}
        />
      ) : (
        <StateNotice
          variant={onlineEligibility.allowed ? 'success' : 'locked'}
          title={
            onlineEligibility.allowed
              ? 'All Documents Verified — Partner Rider ID Active'
              : 'Admin Checking Documents — Rider ID & Duty Locked'
          }
          description={
            onlineEligibility.allowed
              ? 'Super Admin approved your driver and vehicle documents. Your Partner Rider ID is active and you can now go online.'
              : onlineEligibility.blockers.join(' ')
          }
        />
      )}

      {/* Digital Captain ID Card */}
      <div className="rounded-2xl bg-[#1E1E1E] p-5 text-white dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#F5C518]">
              DIGITAL CAPTAIN DRIVER ID
            </p>
            <p className="font-mono-num mt-1 text-xl font-extrabold tracking-wider">
              {driverProfile?.driverCode ||
                driverProfile?.short_id ||
                driverProfile?.partner_rider_id ||
                'Pending Sign-In'}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {driverProfile?.admin_approved
                ? 'Active for Customer App matching, pickup OTPs, and payouts.'
                : 'Use this 10-character Driver ID to sign in across devices while Super Admin verifies your KYC.'}
            </p>
          </div>
          {driverProfile?.admin_approved ? (
            <BadgeCheck className="h-8 w-8 shrink-0 text-[#F5C518]" />
          ) : (
            <Lock className="h-7 w-7 shrink-0 text-neutral-500" />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
        <h2 className="font-display text-base font-bold">Mandatory Production Gates</h2>
        <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
          {gates.map((g) => (
            <div key={g.label} className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">{g.label}</span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  g.ok
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {g.ok ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {g.ok ? 'Verified' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryButton variant="outline" onClick={() => navigate('kyc_decision')}>
            View Decision Details
          </PrimaryButton>
          <PrimaryButton variant="dark" onClick={() => navigate('dashboard')}>
            Return to Dashboard
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

export const KycDecisionScreen: React.FC = () => {
  const { backendConfigured, driverProfile, navigate } = useDriverApp();

  const status = driverProfile?.kyc_status ?? 'not_submitted';
  const approved = Boolean(driverProfile?.admin_approved && status === 'approved');
  const rejected = status === 'rejected';

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="KYC Verification Outcome"
        subtitle="Authoritative decision recorded by SHINE CAB Super Admin"
      />

      {!backendConfigured || !driverProfile ? (
        <StateNotice
          variant="unconfigured"
          title="Sign In Required"
          description="Sign in with Google or Mobile OTP to inspect your live Super Admin KYC verification decision."
          actionLabel="Open Document Upload"
          onAction={() => navigate('document_upload')}
        />
      ) : approved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/25">
          <CheckCircle2 className="h-8 w-8 text-emerald-700 dark:text-emerald-400" />
          <h2 className="mt-3 font-display text-xl font-bold">KYC Approved — Rider ID Active</h2>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            Your driver profile, KYC documents, and vehicle verification are complete. You can now
            toggle Online Duty from the Home Dashboard.
          </p>
          {(driverProfile.driverCode || driverProfile.short_id || driverProfile.partner_rider_id) && (
            <p className="font-mono-num mt-3 inline-block rounded-xl bg-[#1E1E1E] px-3.5 py-2 text-xs font-bold text-[#F5C518]">
              Captain Driver ID:{' '}
              {driverProfile.driverCode ||
                driverProfile.short_id ||
                driverProfile.partner_rider_id}
            </p>
          )}
          <div className="mt-5">
            <PrimaryButton variant="brand" onClick={() => navigate('dashboard')}>
              Go to Driver Dashboard
            </PrimaryButton>
          </div>
        </div>
      ) : rejected ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 dark:border-red-900/60 dark:bg-red-950/25">
          <ShieldX className="h-8 w-8 text-red-700 dark:text-red-400" />
          <h2 className="mt-3 font-display text-xl font-bold">KYC Verification Rejected</h2>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            Reason: {driverProfile.kyc_rejection_reason || 'Submitted documents require re-upload.'}
          </p>
          <div className="mt-5">
            <PrimaryButton variant="dark" onClick={() => navigate('document_upload')}>
              Re-upload Documents
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <StateNotice
          variant="locked"
          title={`Current Status: ${status.replace('_', ' ')}`}
          description="Your submission is waiting for Super Admin verification before your Partner Rider ID is activated."
          actionLabel="Check Approval Checklist"
          onAction={() => navigate('kyc_pending')}
        />
      )}
    </div>
  );
};
