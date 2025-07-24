'use client';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, AlertTriangle, DollarSign, Percent, Search, Download, Printer, Upload, Check, RotateCcw, TrendingUp, TrendingDown, History, Save, BarChart2 } from 'lucide-react';
// import jsPDF from 'jspdf';  // Loaded from CDN
// import html2canvas from 'html2canvas'; // Loaded from CDN

// --- CONFIGURATION & INITIAL DATA (/config/data.ts) ---
const VAT_RATE = 0.15;
const ANCHOR_SUPPLIERS = ['Exide', 'Willard'];
const HOUSE_BRANDS = ['Global 12', 'Novax 18', 'Novax Premium'];
const ALL_BRANDS = [...ANCHOR_SUPPLIERS, ...HOUSE_BRANDS];

const INTERNAL_SKU_CATEGORIES = [
  "610", "611", "612", "615", "616", "619", "621", "622", "628", "630", "631", "634", "636", "636CS / HT", "638", "639", "640 / 643", "646", "651", "652", "652PS 75Ah", "657", "659", "650", "658", "668", "669", "674", "682", "683", "689", "690", "692", "695", "696", "SMF100 / 674TP", "SMF101 / 674SP", "612AGM", "646AGM", "652AGM", "668AGM", "658AGM", "RR0", "RR1"
];

const INITIAL_SUPPLIERS = [
  { id: 's1', name: 'Exide' },
  { id: 's2', name: 'Willard' },
  { id: 's3', name: 'Electro City' },
  { id: 's4', name: 'Enertec' },
];

const INITIAL_SUPPLIER_PRODUCTS = [
  // SKU 619
  { id: 'p1', supplierId: 's1', supplierSku: 'EX-619', internalSku: '619', invoicePrice: 900, scrapCategoryId: 'sv1' },
  { id: 'p2', supplierId: 's2', supplierSku: 'WL-619', internalSku: '619', invoicePrice: 950, scrapCategoryId: 'sv1' },
  { id: 'p3', supplierId: 's3', supplierSku: 'EC-619', internalSku: '619', invoicePrice: 700, scrapCategoryId: 'sv2' },
  // SKU 628
  { id: 'p6', supplierId: 's1', supplierSku: 'EX-628', internalSku: '628', invoicePrice: 1100, scrapCategoryId: 'sv1' },
  { id: 'p7', supplierId: 's2', supplierSku: 'WL-628', internalSku: '628', invoicePrice: 1150, scrapCategoryId: 'sv1' },
  { id: 'p8', supplierId: 's4', supplierSku: 'EN-628', internalSku: '628', invoicePrice: 850, scrapCategoryId: 'sv2' },
  // SKU 652
  { id: 'p9', supplierId: 's1', supplierSku: 'EX-652', internalSku: '652', invoicePrice: 1500, scrapCategoryId: 'sv1' },
  { id: 'p10', supplierId: 's2', supplierSku: 'WL-652', internalSku: '652', invoicePrice: 1550, scrapCategoryId: 'sv1' },
  { id: 'p11', supplierId: 's3', supplierSku: 'EC-652', internalSku: '652', invoicePrice: 1200, scrapCategoryId: 'sv3' },
];

// --- CORE PRICING ENGINE & UTILITIES ---
const getAdjustedCost = (product, suppliers, scrapValues) => {
    const supplier = suppliers.find(s => s.id === product.supplierId);
    if (!supplier) return product.invoicePrice;
    if (ANCHOR_SUPPLIERS.includes(supplier.name)) {
        return product.invoicePrice;
    }
    const scrapValue = scrapValues.find(sv => sv.id === product.scrapCategoryId)?.value || 0;
    return product.invoicePrice - scrapValue;
};

const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return "N/A";
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
};

// --- REUSABLE UI COMPONENTS ---
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
    <div className="p-6 md:p-8">{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 shadow-sm hover:shadow-md',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  };
  return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</button>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-start pt-16 sm:items-center p-4" onClick={onClose}>
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all scale-95 hover:scale-100" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-2 hover:bg-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- MODALS ---
const ProductEditModal = ({ isOpen, onClose, product, suppliers, onSave, scrapValues }) => {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    setFormData(product ? {...product} : null);
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'invoicePrice' ? parseFloat(value) || 0 : value }));
  };

  const handleSave = () => {
    if (formData) onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product?.id ? "Edit Supplier Product" : "Add New Supplier Product"}>
      {formData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <select name="supplierId" value={formData.supplierId} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Internal SKU (Grouping)</label>
              <select name="internalSku" value={formData.internalSku} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm">
                  <option value="">Select a Category</option>
                  {INTERNAL_SKU_CATEGORIES.map(sku => <option key={sku} value={sku}>{sku}</option>)}
              </select>
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700">Supplier's SKU</label>
              <input type="text" name="supplierSku" value={formData.supplierSku} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-lg"/>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700">Invoice Price (Excl. VAT)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                <input type="number" name="invoicePrice" value={formData.invoicePrice} onChange={handleChange} className="mt-1 block w-full p-3 pl-10 border border-gray-300 rounded-lg"/>
              </div>
          </div>
          {!ANCHOR_SUPPLIERS.includes(suppliers.find(s => s.id === formData.supplierId)?.name) && (
            <div>
                <label className="block text-sm font-medium text-gray-700">Scrap Category (for Cost Deduction)</label>
                <select name="scrapCategoryId" value={formData.scrapCategoryId} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-lg">
                    {scrapValues.map(sv => <option key={sv.id} value={sv.id}>{sv.category} ({formatCurrency(sv.value)})</option>)}
                </select>
            </div>
          )}
          <div className="flex justify-end gap-4 pt-6">
            <Button onClick={onClose} variant="secondary">Cancel</Button>
            <Button onClick={handleSave} variant="primary"><Save size={18}/> Save Changes</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const ScrapValueManagerModal = ({ isOpen, onClose, scrapValues, onSave }) => {
    const [localScrapValues, setLocalScrapValues] = useState([]);
    
    useEffect(() => {
        setLocalScrapValues(JSON.parse(JSON.stringify(scrapValues))); // Deep copy
    }, [scrapValues, isOpen]);

    const handleValueChange = (id, newValue) => {
        setLocalScrapValues(current => current.map(sv => sv.id === id ? {...sv, value: parseFloat(newValue) || 0} : sv));
    };

    const handleSave = () => {
        onSave(localScrapValues);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Scrap Values">
            <div className="space-y-4">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Changing these values will impact all cost calculations and profitability analysis across the application.
                            </p>
                        </div>
                    </div>
                </div>
                {localScrapValues.map(sv => (
                    <div key={sv.id} className="flex items-center gap-4">
                        <label className="w-1/3 text-sm font-medium text-gray-700 capitalize">{sv.category}</label>
                        <div className="relative w-2/3">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                            <input 
                                type="number"
                                value={sv.value}
                                onChange={(e) => handleValueChange(sv.id, e.target.value)}
                                className="block w-full p-3 pl-10 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                ))}
                <div className="flex justify-end gap-4 pt-6">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSave} variant="primary"><Save size={18}/> Save Scrap Values</Button>
                </div>
            </div>
        </Modal>
    );
};


// --- VIEWS ---
const SupplierCostView = ({ suppliers, supplierProducts, onProductUpdate, onProductAdd, onProductDelete, scrapValues, onScrapValuesUpdate }) => {
  const [activeSupplierId, setActiveSupplierId] = useState(suppliers[0]?.id);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isScrapModalOpen, setIsScrapModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const activeSupplier = suppliers.find(s => s.id === activeSupplierId);
  const productsForSupplier = supplierProducts.filter(p => p.supplierId === activeSupplierId);

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleAddNewProduct = () => {
    setEditingProduct({
      id: '', supplierId: activeSupplierId, supplierSku: '', internalSku: '', invoicePrice: 0, 
      scrapCategoryId: scrapValues.find(sv => sv.category === 'standard')?.id || ''
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (productData) => {
    if (productData.id) {
      onProductUpdate(productData);
    } else {
      onProductAdd({...productData, id: `p${Date.now()}`});
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Supplier Cost Management</h2>
        <div className="flex gap-2">
            <Button onClick={() => setIsScrapModalOpen(true)} variant="secondary"><DollarSign size={16} /> Manage Scrap Values</Button>
            <Button onClick={handleAddNewProduct} variant="primary" disabled={!activeSupplierId}><Plus size={16} /> Add Product</Button>
        </div>
      </div>
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
          {suppliers.map((supplier) => (
            <button key={supplier.id} onClick={() => setActiveSupplierId(supplier.id)}
              className={`whitespace-nowrap py-3 px-4 border-b-4 font-medium text-base transition-colors ${activeSupplierId === supplier.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {supplier.name}
            </button>
          ))}
        </nav>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">SKU (Internal)</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">SKU (Supplier)</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Invoice Price</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Scrap Deduction</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Adjusted Cost</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productsForSupplier.length > 0 ? productsForSupplier.map(product => {
                const adjustedCost = getAdjustedCost(product, suppliers, scrapValues);
                const scrapDeduction = product.invoicePrice - adjustedCost;
                return (
                  <tr key={product.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.internalSku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.supplierSku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(product.invoicePrice)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">-{formatCurrency(scrapDeduction)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{formatCurrency(adjustedCost)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => handleEditProduct(product)} variant="ghost"><Pencil size={16}/></Button>
                        <Button onClick={() => onProductDelete(product.id)} variant="ghost" className="text-red-500 hover:text-red-700"><Trash2 size={16}/></Button>
                      </div>
                    </td>
                  </tr>
                );
            }) : (
                <tr><td colSpan="6" className="text-center py-12 text-gray-500">No products found for this supplier.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ProductEditModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} product={editingProduct} suppliers={suppliers} onSave={handleSaveProduct} scrapValues={scrapValues}/>
      <ScrapValueManagerModal isOpen={isScrapModalOpen} onClose={() => setIsScrapModalOpen(false)} scrapValues={scrapValues} onSave={onScrapValuesUpdate} />
    </Card>
  );
};

const GpAnalysisView = ({ suppliers, supplierProducts, scrapValues, manualPrices, onPriceChange }) => {
    const [isVatIncluded, setIsVatIncluded] = useState(false);
    const allSkus = useMemo(() => [...new Set(supplierProducts.map(p => p.internalSku))].filter(Boolean).sort(), [supplierProducts]);

    const getCostDataForAnalysis = (sku, brand) => {
        const isAnchor = ANCHOR_SUPPLIERS.includes(brand);
        if (isAnchor) {
            const anchorProducts = supplierProducts.filter(p => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                return p.internalSku === sku && supplier && ANCHOR_SUPPLIERS.includes(supplier.name);
            });
            if (anchorProducts.length < 2) return []; // Need both anchors for a baseline
            const baselineCost = anchorProducts.reduce((acc, p) => acc + p.invoicePrice, 0) / anchorProducts.length;
            return [{ supplierName: 'Baseline', cost: baselineCost }];
        } else {
            const localProducts = supplierProducts.filter(p => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                return p.internalSku === sku && supplier && !ANCHOR_SUPPLIERS.includes(supplier.name);
            });
            if (localProducts.length === 0) return [];

            return localProducts.map(p => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                return {
                    supplierName: supplier?.name || 'Unknown',
                    cost: getAdjustedCost(p, suppliers, scrapValues)
                };
            });
        }
    };

    const handlePriceInputChange = (sku, brand, value) => {
        const price = parseFloat(value) || 0;
        const priceExVat = isVatIncluded ? price / (1 + VAT_RATE) : price;
        onPriceChange(sku, brand, priceExVat);
    };
    
    const getDisplayPrice = (sku, brand) => {
        const priceExVat = manualPrices[`${sku}-${brand}`] || 0;
        return isVatIncluded ? priceExVat * (1 + VAT_RATE) : priceExVat;
    };

    const getGpColor = (gpPercent) => {
        if (gpPercent > 35) return 'text-green-600 bg-green-50';
        if (gpPercent > 15) return 'text-yellow-800 bg-yellow-50';
        if (gpPercent >= 0) return 'text-orange-600 bg-orange-50';
        return 'text-red-600 bg-red-50 font-bold';
    };

    const handleExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "SKU,Brand,Supplier/Basis,Adjusted Cost (Excl. VAT),Selling Price (Excl. VAT),GP (Rand),GP (%)\n";

        allSkus.forEach(sku => {
            ALL_BRANDS.forEach(brand => {
                const costData = getCostDataForAnalysis(sku, brand);
                if (!costData || costData.length === 0) return;

                const priceKey = `${sku}-${brand}`;
                const sellingPrice = manualPrices[priceKey] || 0;
                
                costData.forEach(costItem => {
                    const gpRand = sellingPrice - costItem.cost;
                    const gpPercent = sellingPrice > 0 ? (gpRand / sellingPrice) * 100 : 0;
                    csvContent += `${sku},${brand},${costItem.supplierName},${costItem.cost.toFixed(2)},${sellingPrice.toFixed(2)},${gpRand.toFixed(2)},${gpPercent.toFixed(1)}\n`;
                });
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gp_analysis_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const analysisStructure = useMemo(() => {
        return allSkus.map(sku => {
            const brandsData = ALL_BRANDS.map(brand => {
                const costData = getCostDataForAnalysis(sku, brand);
                return { brand, costData };
            }).filter(b => b.costData.length > 0);
            
            const totalRows = brandsData.reduce((acc, b) => acc + b.costData.length, 0);
            return { sku, brandsData, totalRows };
        }).filter(s => s.totalRows > 0);
    }, [allSkus, suppliers, supplierProducts, scrapValues]);


    return (
        <Card>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">"Price-First" GP Analysis</h2>
                    <p className="text-gray-600">Enter your selling prices to instantly see the resulting Gross Profit.</p>
                </div>
                <Button onClick={handleExport} variant="secondary"><Download size={16}/> Export Analysis</Button>
            </div>
            
            <div className="flex justify-end items-center mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <span className="text-sm font-medium text-gray-700">Price Input is Excl. VAT</span>
                    <div className="relative">
                        <input type="checkbox" checked={isVatIncluded} onChange={() => setIsVatIncluded(!isVatIncluded)} className="sr-only peer" />
                        <div className="block w-14 h-8 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition"></div>
                        <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Incl. VAT</span>
                </label>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Brand</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Supplier / Basis</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Adjusted Cost (Excl. VAT)</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Selling Price ({isVatIncluded ? 'Incl. VAT' : 'Excl. VAT'})</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">GP (Rand)</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">GP (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analysisStructure.map(({ sku, brandsData, totalRows }) => (
                            brandsData.map(({ brand, costData }, brandIndex) => (
                                costData.map((costItem, costIndex) => {
                                    const priceKey = `${sku}-${brand}`;
                                    const sellingPriceExVat = manualPrices[priceKey] || 0;
                                    const gpRand = sellingPriceExVat - costItem.cost;
                                    const gpPercent = sellingPriceExVat > 0 ? (gpRand / sellingPriceExVat) * 100 : 0;
                                    
                                    return (
                                        <tr key={`${sku}-${brand}-${costItem.supplierName}`}>
                                            {brandIndex === 0 && costIndex === 0 && (
                                                <td rowSpan={totalRows} className="px-4 py-4 align-top font-bold text-blue-800 text-md border-b border-gray-300">{sku}</td>
                                            )}
                                            {costIndex === 0 && (
                                                <td rowSpan={costData.length} className="px-4 py-4 align-top font-medium text-gray-700 border-b">{brand}</td>
                                            )}
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b">{costItem.supplierName}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 border-b">{formatCurrency(costItem.cost)}</td>
                                            {costIndex === 0 && (
                                                <td rowSpan={costData.length} className="px-4 py-3 border-b align-middle">
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                                        <input
                                                            type="number"
                                                            value={getDisplayPrice(sku, brand).toFixed(2)}
                                                            onChange={(e) => handlePriceInputChange(sku, brand, e.target.value)}
                                                            className="w-32 p-2 pl-8 border border-gray-300 rounded-md shadow-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                            <td className={`px-4 py-3 text-sm font-semibold border-b ${getGpColor(gpPercent)}`}>{formatCurrency(gpRand)}</td>
                                            <td className={`px-4 py-3 text-sm font-bold border-b ${getGpColor(gpPercent)}`}>{gpPercent.toFixed(1)}%</td>
                                        </tr>
                                    );
                                })
                            ))
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState('analysis'); // Default to the new analysis tool
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
  const [supplierProducts, setSupplierProducts] = useState(INITIAL_SUPPLIER_PRODUCTS);
  const [scrapValues, setScrapValues] = useState([
    { id: 'sv1', category: 'none', value: 0 },
    { id: 'sv2', category: 'standard', value: 150 },
    { id: 'sv3', category: 'large', value: 250 },
  ]);
  const [manualPrices, setManualPrices] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    const jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jspdfScript.async = true;
    document.body.appendChild(jspdfScript);

    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    html2canvasScript.async = true;
    document.body.appendChild(html2canvasScript);
      
    setIsMounted(true);

    return () => {
        document.body.removeChild(jspdfScript);
        document.body.removeChild(html2canvasScript);
    }
  }, []);

  const handleExportData = () => {
    const dataToExport = { suppliers, supplierProducts, scrapValues, manualPrices };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `gbsa_pricing_data_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        if (importedData.supplierProducts && importedData.supplierProducts[0] && 'scrapType' in importedData.supplierProducts[0]) {
            console.log("Old data format detected. Migrating...");
            const defaultScrapValues = [
                { id: 'sv1', category: 'none', value: 0 },
                { id: 'sv2', category: 'standard', value: 150 },
                { id: 'sv3', category: 'large', value: 250 },
            ];
            const scrapTypeToIdMap = {
                'none': defaultScrapValues.find(s => s.category === 'none').id,
                'standard': defaultScrapValues.find(s => s.category === 'standard').id,
                'large': defaultScrapValues.find(s => s.category === 'large').id,
            };

            importedData.supplierProducts = importedData.supplierProducts.map(product => {
                const { scrapType, supplierType, ...rest } = product;
                return {
                    ...rest,
                    scrapCategoryId: scrapTypeToIdMap[scrapType] || scrapTypeToIdMap['none'],
                };
            });
        }

        if (importedData.suppliers && importedData.supplierProducts) {
          setSuppliers(importedData.suppliers);
          setSupplierProducts(importedData.supplierProducts);
          if (importedData.scrapValues) setScrapValues(importedData.scrapValues);
          if(importedData.manualPrices) setManualPrices(importedData.manualPrices);
          alert('Data imported successfully!');
        } else {
          alert('Invalid data file format. The file must contain at least suppliers and supplierProducts.');
        }
      } catch (error) {
        alert('Error reading or parsing the file.');
        console.error("Import error:", error);
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const triggerImport = () => fileInputRef.current.click();

  const handleManualPriceChange = (sku, brand, price) => {
      const key = `${sku}-${brand}`;
      setManualPrices(prev => ({...prev, [key]: price}));
  }

  const handleProductUpdate = (updatedProduct) => setSupplierProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  const handleProductAdd = (newProduct) => {
    setSupplierProducts(prev => [...prev, newProduct]);
  };
  const handleProductDelete = (productId) => setSupplierProducts(prev => prev.filter(p => p.id !== productId));

  if (!isMounted) return <div className="flex justify-center items-center min-h-screen bg-gray-100 text-gray-700">Initializing Pricing Engine...</div>;

  const renderActiveView = () => {
    switch (activeView) {
      case 'analysis': return <GpAnalysisView suppliers={suppliers} supplierProducts={supplierProducts} scrapValues={scrapValues} manualPrices={manualPrices} onPriceChange={handleManualPriceChange} />;
      case 'costs': return <SupplierCostView suppliers={suppliers} supplierProducts={supplierProducts} onProductUpdate={handleProductUpdate} onProductAdd={handleProductAdd} onProductDelete={handleProductDelete} scrapValues={scrapValues} onScrapValuesUpdate={setScrapValues} />;
      default: return null;
    }
  };

  return (
    <>
      <style>{`
        @media print { body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none; } }
      `}</style>
      <div className="bg-gray-100 min-h-screen font-sans">
        <header className="bg-white shadow-md no-print sticky top-0 z-40">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-6">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">GBSA<span className="text-blue-600">Tools</span></h1>
              </div>
              <div className="flex items-center gap-3">
                  <input type="file" ref={fileInputRef} onChange={handleImportData} className="hidden" accept=".json"/>
                  <Button onClick={triggerImport} variant="secondary"><Upload size={16}/> Import Data</Button>
                  <Button onClick={handleExportData} variant="secondary"><Download size={16}/> Export Data</Button>
              </div>
            </div>
          </div>
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveView('analysis')} className={`whitespace-nowrap py-4 px-1 border-b-4 font-semibold text-lg transition-colors flex items-center gap-2 ${activeView === 'analysis' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}><BarChart2 size={20}/> GP Analysis</button>
                    <button onClick={() => setActiveView('costs')} className={`whitespace-nowrap py-4 px-1 border-b-4 font-semibold text-lg transition-colors ${activeView === 'costs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Supplier Costs</button>
                </nav>
              </div>
          </div>
        </header>
        
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderActiveView()}
        </main>
      </div>
    </>
  );
}
