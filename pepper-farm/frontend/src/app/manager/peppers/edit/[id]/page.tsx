"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPepperById, updatePepper, uploadPepperImage } from "@/services/peppers";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
      {children}
    </p>
  );
}

function FieldGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditPepperPage() {
  const params = useParams();
  const router = useRouter();
  const pepperId = Number(params.id);

  const [formData, setFormData] = useState({
    PepperName: "",
    ScientificName: "",
    HeatLevelScovilleMin: "",
    HeatLevelScovilleMax: "",
    OptimalSoilMoistureMin: "",
    OptimalSoilMoistureMax: "",
    OptimalTempMinC: "",
    OptimalTempMaxC: "",
    OptimalPARMin: "",
    OptimalPARMax: "",
    ImageUrl: "",
    Zone: "",
    GeneralDescription: "",
    IsActive: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingPepper, setFetchingPepper] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getPepperById(pepperId)
      .then((pepper) => {
        setFormData({
          PepperName: pepper.PepperName ?? "",
          ScientificName: pepper.ScientificName ?? "",
          HeatLevelScovilleMin: pepper.HeatLevelScovilleMin?.toString() ?? "",
          HeatLevelScovilleMax: pepper.HeatLevelScovilleMax?.toString() ?? "",
          OptimalSoilMoistureMin: pepper.OptimalSoilMoistureMin?.toString() ?? "",
          OptimalSoilMoistureMax: pepper.OptimalSoilMoistureMax?.toString() ?? "",
          OptimalTempMinC: pepper.OptimalTempMinC?.toString() ?? "",
          OptimalTempMaxC: pepper.OptimalTempMaxC?.toString() ?? "",
          OptimalPARMin: pepper.OptimalPARMin?.toString() ?? "",
          OptimalPARMax: pepper.OptimalPARMax?.toString() ?? "",
          ImageUrl: pepper.ImageUrl ?? "",
          Zone: pepper.Zone ?? "",
          GeneralDescription: pepper.GeneralDescription ?? "",
          IsActive: pepper.IsActive,
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setErrorMessage(`Pepper with id ${pepperId} not found.`);
        } else {
          setErrorMessage("Failed to load pepper data.");
        }
      })
      .finally(() => setFetchingPepper(false));
  }, [pepperId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox" && "checked" in e.target) {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toOptionalNumber = (value: string): number | undefined => {
    if (value.trim() === "") return undefined;
    return Number(value);
  };

  const validateForm = (): string | null => {
    if (!formData.PepperName.trim()) return "Pepper name is required.";
    if (formData.PepperName.trim().length > 100) return "Pepper name cannot exceed 100 characters.";
    if (formData.ScientificName.trim().length > 150) return "Scientific name cannot exceed 150 characters.";
    if (formData.ImageUrl.trim().length > 500) return "Image URL cannot exceed 500 characters.";
    if (formData.Zone.trim().length > 500) return "Zone cannot exceed 500 characters.";
    if (formData.GeneralDescription.trim().length > 1000) return "General description cannot exceed 1000 characters.";

    const scovilleMin = toOptionalNumber(formData.HeatLevelScovilleMin);
    const scovilleMax = toOptionalNumber(formData.HeatLevelScovilleMax);
    const soilMin = toOptionalNumber(formData.OptimalSoilMoistureMin);
    const soilMax = toOptionalNumber(formData.OptimalSoilMoistureMax);
    const tempMin = toOptionalNumber(formData.OptimalTempMinC);
    const tempMax = toOptionalNumber(formData.OptimalTempMaxC);
    const parMin = toOptionalNumber(formData.OptimalPARMin);
    const parMax = toOptionalNumber(formData.OptimalPARMax);

    if (scovilleMin !== undefined && scovilleMin < 0) return "Scoville min cannot be negative.";
    if (scovilleMax !== undefined && scovilleMax < 0) return "Scoville max cannot be negative.";
    if (scovilleMin !== undefined && scovilleMax !== undefined && scovilleMin > scovilleMax)
      return "Scoville min cannot be greater than max.";

    if (soilMin !== undefined && (soilMin < 0 || soilMin > 100)) return "Soil moisture min must be between 0 and 100.";
    if (soilMax !== undefined && (soilMax < 0 || soilMax > 100)) return "Soil moisture max must be between 0 and 100.";
    if (soilMin !== undefined && soilMax !== undefined && soilMin > soilMax)
      return "Soil moisture min cannot be greater than max.";

    if (tempMin !== undefined && (tempMin < -50 || tempMin > 80)) return "Temperature min must be between -50 and 80°C.";
    if (tempMax !== undefined && (tempMax < -50 || tempMax > 80)) return "Temperature max must be between -50 and 80°C.";
    if (tempMin !== undefined && tempMax !== undefined && tempMin > tempMax)
      return "Temperature min cannot be greater than max.";

    if (parMin !== undefined && (parMin < 0 || parMin > 2000)) return "PAR min must be between 0 and 2000 µmol/m²/s.";
    if (parMax !== undefined && (parMax < 0 || parMax > 2000)) return "PAR max must be between 0 and 2000 µmol/m²/s.";
    if (parMin !== undefined && parMax !== undefined && parMin > parMax)
      return "PAR min cannot be greater than PAR max.";

    if (formData.ImageUrl.trim()) {
      const u = formData.ImageUrl.trim();
      if (!u.startsWith("http://") && !u.startsWith("https://") && !u.startsWith("/uploads/"))
        return "Image URL must start with http://, https://, or /uploads/.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      setLoading(false);
      return;
    }

    try {
      let finalImageUrl = formData.ImageUrl.trim() || undefined;

      if (selectedFile) {
        setUploadingImage(true);
        const uploadResult = await uploadPepperImage(selectedFile);
        finalImageUrl = uploadResult.imageUrl;
        setUploadingImage(false);
      }

      await updatePepper(pepperId, {
        PepperName: formData.PepperName.trim(),
        ScientificName: formData.ScientificName.trim() || undefined,
        HeatLevelScovilleMin: toOptionalNumber(formData.HeatLevelScovilleMin),
        HeatLevelScovilleMax: toOptionalNumber(formData.HeatLevelScovilleMax),
        OptimalSoilMoistureMin: toOptionalNumber(formData.OptimalSoilMoistureMin),
        OptimalSoilMoistureMax: toOptionalNumber(formData.OptimalSoilMoistureMax),
        OptimalTempMinC: toOptionalNumber(formData.OptimalTempMinC),
        OptimalTempMaxC: toOptionalNumber(formData.OptimalTempMaxC),
        OptimalPARMin: toOptionalNumber(formData.OptimalPARMin),
        OptimalPARMax: toOptionalNumber(formData.OptimalPARMax),
        ImageUrl: finalImageUrl,
        Zone: formData.Zone.trim() || undefined,
        GeneralDescription: formData.GeneralDescription.trim() || undefined,
        IsActive: formData.IsActive,
      });

      setSuccessMessage("Pepper updated successfully.");
      setTimeout(() => router.push("/manager/peppers"), 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update pepper.");
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  // ── Loading skeleton ──
  if (fetchingPepper) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
        {[1, 2, 3, 4].map((n) => (
          <Card key={n}>
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-5" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Page header */}
      <PageHeader
        label="Pepper Varieties"
        title="Edit Pepper Variety"
        subtitle={formData.PepperName ? `Editing: ${formData.PepperName}` : `Pepper #${pepperId}`}
        action={
          <Button variant="outline" onClick={() => router.push("/manager/peppers")}>
            ← Back to Varieties
          </Button>
        }
      />

      {/* Global messages */}
      {successMessage && (
        <Alert variant="success">{successMessage}</Alert>
      )}
      {errorMessage && (
        <Alert variant="error">{errorMessage}</Alert>
      )}

      {!errorMessage.includes("not found") && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Section 1: Basic Information ── */}
          <Card>
            <SectionLabel>Basic Information</SectionLabel>
            <FieldGroup>
              <div className="sm:col-span-2">
                <Input
                  id="PepperName"
                  name="PepperName"
                  label="Pepper Name *"
                  placeholder="e.g. Jalapeño"
                  value={formData.PepperName}
                  onChange={handleChange}
                  maxLength={100}
                  required
                />
              </div>
              <Input
                id="ScientificName"
                name="ScientificName"
                label="Scientific Name"
                placeholder="e.g. Capsicum annuum"
                value={formData.ScientificName}
                onChange={handleChange}
                maxLength={150}
              />
              <Input
                id="Zone"
                name="Zone"
                label="Growing Zone"
                placeholder="e.g. tropical, temperate"
                value={formData.Zone}
                onChange={handleChange}
              />
            </FieldGroup>
          </Card>

          {/* ── Section 2: Heat Level ── */}
          <Card>
            <SectionLabel>Heat Level — Scoville Scale</SectionLabel>
            <FieldGroup>
              <Input
                id="HeatLevelScovilleMin"
                name="HeatLevelScovilleMin"
                type="number"
                step="1"
                min="0"
                label="Min Scoville (SHU)"
                placeholder="e.g. 2 500"
                value={formData.HeatLevelScovilleMin}
                onChange={handleChange}
              />
              <Input
                id="HeatLevelScovilleMax"
                name="HeatLevelScovilleMax"
                type="number"
                step="1"
                min="0"
                label="Max Scoville (SHU)"
                placeholder="e.g. 8 000"
                value={formData.HeatLevelScovilleMax}
                onChange={handleChange}
              />
            </FieldGroup>
          </Card>

          {/* ── Section 3: Growing Conditions ── */}
          <Card>
            <SectionLabel>Growing Conditions</SectionLabel>
            <FieldGroup>
              <Input
                id="OptimalSoilMoistureMin"
                name="OptimalSoilMoistureMin"
                type="number"
                step="0.01"
                min="0"
                max="100"
                label="Min Soil Moisture (%)"
                placeholder="e.g. 40"
                value={formData.OptimalSoilMoistureMin}
                onChange={handleChange}
              />
              <Input
                id="OptimalSoilMoistureMax"
                name="OptimalSoilMoistureMax"
                type="number"
                step="0.01"
                min="0"
                max="100"
                label="Max Soil Moisture (%)"
                placeholder="e.g. 60"
                value={formData.OptimalSoilMoistureMax}
                onChange={handleChange}
              />
              <Input
                id="OptimalTempMinC"
                name="OptimalTempMinC"
                type="number"
                step="0.01"
                min="-50"
                max="80"
                label="Min Temperature (°C)"
                placeholder="e.g. 18"
                value={formData.OptimalTempMinC}
                onChange={handleChange}
              />
              <Input
                id="OptimalTempMaxC"
                name="OptimalTempMaxC"
                type="number"
                step="0.01"
                min="-50"
                max="80"
                label="Max Temperature (°C)"
                placeholder="e.g. 30"
                value={formData.OptimalTempMaxC}
                onChange={handleChange}
              />
            </FieldGroup>
          </Card>

          {/* ── Section 4: PAR ── */}
          <Card tinted>
            <SectionLabel>Optimal PAR Range</SectionLabel>
            <p className="text-xs text-gray-500 -mt-3 mb-5">
              PAR (Photosynthetically Active Radiation) is the portion of light that plants use for
              photosynthesis — wavelengths 400–700 nm. Measured in µmol/m²/s. Typical range: 0–2 000.
            </p>
            <FieldGroup>
              <Input
                id="OptimalPARMin"
                name="OptimalPARMin"
                type="number"
                step="0.01"
                min="0"
                max="2000"
                label="Minimum optimal PAR (µmol/m²/s)"
                placeholder="e.g. 200"
                value={formData.OptimalPARMin}
                onChange={handleChange}
              />
              <Input
                id="OptimalPARMax"
                name="OptimalPARMax"
                type="number"
                step="0.01"
                min="0"
                max="2000"
                label="Maximum optimal PAR (µmol/m²/s)"
                placeholder="e.g. 800"
                value={formData.OptimalPARMax}
                onChange={handleChange}
              />
            </FieldGroup>
          </Card>

          {/* ── Section 5: Image & Description ── */}
          <Card>
            <SectionLabel>Image &amp; Description</SectionLabel>
            <div className="space-y-4">
              <Input
                id="ImageUrl"
                name="ImageUrl"
                label="Image URL (optional)"
                placeholder="https://example.com/pepper.jpg or /uploads/..."
                value={formData.ImageUrl}
                onChange={handleChange}
                maxLength={500}
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Upload New Image (optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-[#DDE5DC] file:text-xs file:font-medium file:text-[#2F6F4E] file:bg-white hover:file:bg-[#E8F3EC] file:cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-xs text-gray-400">Selected: {selectedFile.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="GeneralDescription" className="text-sm font-medium text-gray-700">
                  General Description
                </label>
                <textarea
                  id="GeneralDescription"
                  name="GeneralDescription"
                  rows={4}
                  placeholder="Describe the pepper variety, flavour profile, common uses…"
                  value={formData.GeneralDescription}
                  onChange={handleChange}
                  maxLength={1000}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">
                  {formData.GeneralDescription.length}/1000
                </p>
              </div>
            </div>
          </Card>

          {/* ── Section 6: Status & Actions ── */}
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                <input
                  id="IsActive"
                  name="IsActive"
                  type="checkbox"
                  checked={formData.IsActive}
                  onChange={handleChange}
                  className="w-4 h-4 accent-[#2F6F4E] cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  Active — visible in the system
                </span>
              </label>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/manager/peppers")}
                  disabled={loading || uploadingImage}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || uploadingImage}
                >
                  {uploadingImage
                    ? "Uploading image…"
                    : loading
                    ? "Saving…"
                    : "Save Changes"}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
