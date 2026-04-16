"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPepperById, updatePepper, uploadPepperImage } from "@/services/peppers";

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
    OptimalSunlightHours: "",
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
          OptimalSunlightHours: pepper.OptimalSunlightHours?.toString() ?? "",
          ImageUrl: pepper.ImageUrl ?? "",
          Zone: pepper.Zone ?? "",
          GeneralDescription: pepper.GeneralDescription ?? "",
          IsActive: pepper.IsActive,
        });
      })
      .catch(() => setErrorMessage("Failed to load pepper data."))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

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
        OptimalSunlightHours: toOptionalNumber(formData.OptimalSunlightHours),
        ImageUrl: finalImageUrl,
        Zone: formData.Zone.trim() || undefined,
        GeneralDescription: formData.GeneralDescription.trim() || undefined,
        IsActive: formData.IsActive,
      });

      setSuccessMessage("Pepper updated successfully.");
      setTimeout(() => router.push("/manager/peppers"), 1000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update pepper.");
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  if (fetchingPepper) {
    return <p style={{ padding: "24px", color: "#888" }}>Loading pepper data...</p>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button type="button" onClick={() => router.push("/manager/peppers")} style={{ color: "#666", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>
          ← Back
        </button>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: 0 }}>Edit Pepper Variety</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        <input name="PepperName" placeholder="Pepper Name" value={formData.PepperName} onChange={handleChange} required />
        <input name="ScientificName" placeholder="Scientific Name" value={formData.ScientificName} onChange={handleChange} />
        <input name="HeatLevelScovilleMin" type="number" step="1" placeholder="Heat Level Scoville Min" value={formData.HeatLevelScovilleMin} onChange={handleChange} />
        <input name="HeatLevelScovilleMax" type="number" step="1" placeholder="Heat Level Scoville Max" value={formData.HeatLevelScovilleMax} onChange={handleChange} />
        <input name="OptimalSoilMoistureMin" type="number" step="0.01" placeholder="Optimal Soil Moisture Min" value={formData.OptimalSoilMoistureMin} onChange={handleChange} />
        <input name="OptimalSoilMoistureMax" type="number" step="0.01" placeholder="Optimal Soil Moisture Max" value={formData.OptimalSoilMoistureMax} onChange={handleChange} />
        <input name="OptimalTempMinC" type="number" step="0.01" placeholder="Optimal Temp Min (C)" value={formData.OptimalTempMinC} onChange={handleChange} />
        <input name="OptimalTempMaxC" type="number" step="0.01" placeholder="Optimal Temp Max (C)" value={formData.OptimalTempMaxC} onChange={handleChange} />
        <input name="OptimalSunlightHours" type="number" step="0.01" placeholder="Optimal Sunlight Hours" value={formData.OptimalSunlightHours} onChange={handleChange} />
        <input name="ImageUrl" placeholder="Image URL (optional)" value={formData.ImageUrl} onChange={handleChange} />
        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
        <input name="Zone" placeholder="Zone" value={formData.Zone} onChange={handleChange} />
        <textarea name="GeneralDescription" placeholder="General Description" value={formData.GeneralDescription} onChange={handleChange} rows={5} />
        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input name="IsActive" type="checkbox" checked={formData.IsActive} onChange={handleChange} />
          Active
        </label>

        <button type="submit" disabled={loading || uploadingImage}>
          {uploadingImage ? "Uploading image..." : loading ? "Saving..." : "Save Changes"}
        </button>

        {successMessage && <p style={{ color: "green", fontWeight: 600 }}>{successMessage}</p>}
        {errorMessage && <p style={{ color: "red", fontWeight: 600 }}>{errorMessage}</p>}
      </form>
    </div>
  );
}
