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
  <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-6 py-8">
    <div className="mx-auto max-w-3xl">
      
      <button
        type="button"
        onClick={() => router.push("/manager/peppers")}
        className="mb-6 text-sm font-medium text-gray-600 hover:text-green-700"
      >
        ← Back
      </button>

      <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-100">

        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Edit Pepper Variety
        </h1>

        {successMessage && (
          <div className="mb-4 rounded-xl bg-green-100 text-green-700 px-4 py-2 text-sm">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-xl bg-red-100 text-red-700 px-4 py-2 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <input
            name="PepperName"
            placeholder="Pepper Name"
            value={formData.PepperName}
            onChange={handleChange}
            required
            className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-400 outline-none"
          />

          <input
            name="ScientificName"
            placeholder="Scientific Name"
            value={formData.ScientificName}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              name="HeatLevelScovilleMin"
              type="number"
              placeholder="Heat Min"
              value={formData.HeatLevelScovilleMin}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
            <input
              name="HeatLevelScovilleMax"
              type="number"
              placeholder="Heat Max"
              value={formData.HeatLevelScovilleMax}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              name="OptimalSoilMoistureMin"
              type="number"
              placeholder="Soil Min"
              value={formData.OptimalSoilMoistureMin}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
            <input
              name="OptimalSoilMoistureMax"
              type="number"
              placeholder="Soil Max"
              value={formData.OptimalSoilMoistureMax}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              name="OptimalTempMinC"
              type="number"
              placeholder="Temp Min"
              value={formData.OptimalTempMinC}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
            <input
              name="OptimalTempMaxC"
              type="number"
              placeholder="Temp Max"
              value={formData.OptimalTempMaxC}
              onChange={handleChange}
              className="border rounded-xl px-4 py-3"
            />
          </div>

          <input
            name="OptimalSunlightHours"
            type="number"
            placeholder="Sunlight Hours"
            value={formData.OptimalSunlightHours}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3"
          />

          <input
            name="ImageUrl"
            placeholder="Image URL"
            value={formData.ImageUrl}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3"
          />

          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="w-full"
          />

          <input
            name="Zone"
            placeholder="Zone"
            value={formData.Zone}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3"
          />

          <textarea
            name="GeneralDescription"
            placeholder="Description"
            value={formData.GeneralDescription}
            onChange={handleChange}
            rows={4}
            className="w-full border rounded-xl px-4 py-3"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              name="IsActive"
              type="checkbox"
              checked={formData.IsActive}
              onChange={handleChange}
            />
            Active
          </label>

          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>

        </form>
      </div>
    </div>
  </div>
);
}
