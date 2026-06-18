import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { 
  useListProducts, 
  useListRecipes,
  useListRecipeIngredients,
  useCreateRecipe,
  useDeleteRecipe,
  useReplaceRecipeIngredients,
  useListInventory,
  useListCategories,
  useCreateProduct,
  getListRecipesQueryKey,
  getListRecipeIngredientsQueryKey,
  getListProductsQueryKey,
  customFetch,
  Product,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Save, ChefHat, PackagePlus, Pencil, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

type ProductWithExtras = Product & { salePrice?: number | null; variants?: Array<{name: string; price: number}> | null };

export default function Recipes() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<ProductWithExtras | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const { data: products = [] } = useListProducts();
  const { data: recipes = [] } = useListRecipes({ query: { queryKey: getListRecipesQueryKey() } });
  const { data: inventory = [] } = useListInventory();
  const { data: categories = [] } = useListCategories();

  const recipe = recipes.find(r => r.productId === selectedProduct?.id);

  const { data: ingredientsData = [] } = useListRecipeIngredients(
    recipe?.id || 0,
    { query: { enabled: !!recipe?.id, queryKey: getListRecipeIngredientsQueryKey(recipe?.id || 0) } }
  );

  const createRecipe = useCreateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const replaceIngredients = useReplaceRecipeIngredients();
  const createProduct = useCreateProduct();

  const updateProduct = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      customFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  });

  const deleteProduct = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      customFetch(`/api/products/${id}`, { method: "DELETE" }),
  });

  const handleOpenEditName = (product: ProductWithExtras, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditNameProduct(product);
    setEditNameValue(product.name);
    setEditNameOpen(true);
  };

  const handleSaveName = () => {
    if (!editNameProduct || !editNameValue.trim()) return;
    updateProduct.mutate({
      id: editNameProduct.id,
      body: {
        name: editNameValue.trim(),
        categoryId: editNameProduct.categoryId,
        price: Number(editNameProduct.price),
        active: editNameProduct.active,
      }
    }, {
      onSuccess: () => {
        toast.success("Nombre actualizado");
        setEditNameOpen(false);
        if (selectedProduct?.id === editNameProduct.id) {
          setSelectedProduct({ ...selectedProduct, name: editNameValue.trim() });
        }
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleDeleteProduct = (product: ProductWithExtras, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${product.name}" del menú?\nEsto también eliminará su receta.`)) return;
    deleteProduct.mutate({ id: product.id }, {
      onSuccess: () => {
        toast.success(`"${product.name}" eliminado`);
        if (selectedProduct?.id === product.id) {
          setSelectedProduct(null);
          setIsEditing(false);
        }
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editVariants, setEditVariants] = useState<Array<{name: string; price: string}>>([]);
  const [draftIngredients, setDraftIngredients] = useState<Array<{ inventoryItemId: number; quantity: number }>>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Editar nombre del producto
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameProduct, setEditNameProduct] = useState<ProductWithExtras | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const handleSelectProduct = (product: ProductWithExtras) => {
    setSelectedProduct(product);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setDraftIngredients(ingredientsData.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })));
    setIsEditing(true);
  };

  const handleCreateRecipe = () => {
    if (!selectedProduct) return;
    createRecipe.mutate({ data: { productId: selectedProduct.id, notes: "" } }, {
      onSuccess: () => {
        toast.success("Receta creada");
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        setIsEditing(true);
        setDraftIngredients([]);
      }
    });
  };

  const handleDeleteRecipe = () => {
    if (!recipe) return;
    if (!confirm(`¿Eliminar la receta de "${selectedProduct?.name}"?`)) return;
    deleteRecipe.mutate({ id: recipe.id }, {
      onSuccess: () => {
        toast.success("Receta eliminada");
        setIsEditing(false);
        setDraftIngredients([]);
        queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      },
    });
  };

  const handleSave = () => {
    if (!recipe) return;
    replaceIngredients.mutate({ id: recipe.id, data: { ingredients: draftIngredients } }, {
      onSuccess: () => {
        toast.success("Receta guardada");
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getListRecipeIngredientsQueryKey(recipe.id) });
      }
    });
  };

  const handleOpenEditPrice = (product: ProductWithExtras) => {
    setSelectedProduct(product);
    setEditPrice(String(product.price));
    setEditSalePrice(product.salePrice ? String(product.salePrice) : "");
    setEditVariants(product.variants ? product.variants.map(v => ({ name: v.name, price: String(v.price) })) : []);
    setEditPriceOpen(true);
  };

  const handleSavePrice = () => {
    if (!selectedProduct) return;
    updateProduct.mutate({
      id: selectedProduct.id,
      body: {
        name: selectedProduct.name,
        categoryId: selectedProduct.categoryId,
        price: Number(editPrice),
        sale_price: editSalePrice ? Number(editSalePrice) : null,
        variants: editVariants.length > 0 ? editVariants.map(v => ({ name: v.name, price: Number(v.price) })) : null,
        active: selectedProduct.active,
      }
    }, {
      onSuccess: (data: any) => {
        toast.success("Precios actualizados");
        setEditPriceOpen(false);
        setSelectedProduct(data);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleCreateProduct = () => {
    if (!newName || !newPrice || !newCategoryId) { toast.error("Completa todos los campos"); return; }
    createProduct.mutate({
      data: { name: newName, price: Number(newPrice), categoryId: Number(newCategoryId), active: true }
    }, {
      onSuccess: (product) => {
        toast.success(`Producto "${newName}" creado`);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setNewProductOpen(false);
        setNewName(""); setNewPrice(""); setNewCategoryId("");
        setSelectedProduct(product as ProductWithExtras);
        setIsEditing(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const addIngredientRow = () => {
    if (inventory.length === 0) return;
    setDraftIngredients([...draftIngredients, { inventoryItemId: inventory[0].id, quantity: 1 }]);
  };

  const updateIngredientRow = (index: number, field: "inventoryItemId" | "quantity", value: number) => {
    const newDraft = [...draftIngredients];
    newDraft[index] = { ...newDraft[index], [field]: value };
    setDraftIngredients(newDraft);
  };

  const removeIngredientRow = (index: number) => setDraftIngredients(draftIngredients.filter((_, i) => i !== index));

  const recipeCost = ingredientsData.reduce((total, ing) => {
    const inv = inventory.find(i => i.id === ing.inventoryItemId);
    return total + (inv ? Number(inv.cost) * Number(ing.quantity) : 0);
  }, 0);

  const margin = selectedProduct && recipeCost > 0
    ? ((Number(selectedProduct.price) - recipeCost) / Number(selectedProduct.price)) * 100
    : null;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      <Card className="w-1/3 flex flex-col h-full">
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-center">
            <div><CardTitle>Menú</CardTitle><CardDescription>Selecciona un producto</CardDescription></div>
            <Button size="sm" onClick={() => setNewProductOpen(true)}><PackagePlus className="w-4 h-4 mr-1" /> Nuevo</Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {(products as ProductWithExtras[]).map(product => {
              const hasRecipe = recipes.some(r => r.productId === product.id);
              return (
                <div key={product.id} className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${selectedProduct?.id === product.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  <div className="flex-1 cursor-pointer" onClick={() => handleSelectProduct(product)}>
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className={`text-xs flex items-center gap-1 ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatCurrency(Number(product.price))}
                      {product.salePrice && <span className="bg-orange-500 text-white text-xs px-1 rounded">OFERTA</span>}
                    </div>
                  </div>
                  {/* Editar nombre */}
                  <button
                    className={`p-1 rounded hover:bg-black/10 shrink-0 ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    onClick={(e) => handleOpenEditName(product, e)}
                    title="Editar nombre"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {/* Editar precios */}
                  <button
                    className={`p-1 rounded hover:bg-black/10 shrink-0 ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    onClick={(e) => { e.stopPropagation(); handleOpenEditPrice(product); }}
                    title="Editar precios"
                  >
                    <Tag className="w-3 h-3" />
                  </button>
                  {/* Eliminar platillo */}
                  <button
                    className={`p-1 rounded hover:bg-red-500/20 shrink-0 text-red-400`}
                    onClick={(e) => handleDeleteProduct(product, e)}
                    title="Eliminar platillo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {hasRecipe && <ChefHat className={`w-4 h-4 flex-shrink-0 ${selectedProduct?.id === product.id ? "text-primary-foreground/70" : "text-muted-foreground"}`} />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col h-full">
        {selectedProduct ? (
          <>
            <CardHeader className="border-b bg-muted/20">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl">{selectedProduct.name}</CardTitle>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-muted-foreground text-sm">Precio: {formatCurrency(Number(selectedProduct.price))}</span>
                    {recipeCost > 0 && (<>
                      <span className="text-muted-foreground text-sm">•</span>
                      <span className="text-sm">Costo: <strong>{formatCurrency(recipeCost)}</strong></span>
                      {margin !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${margin > 40 ? "bg-green-500/20 text-green-400" : margin > 20 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                          Margen {margin.toFixed(0)}%
                        </span>
                      )}
                    </>)}
                  </div>
                </div>
                {recipe && !isEditing && (
                  <div className="flex gap-2">
                    <Button onClick={handleEdit} variant="outline">Editar</Button>
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30" onClick={handleDeleteRecipe} disabled={deleteRecipe.isPending}>
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                    </Button>
                  </div>
                )}
                {recipe && isEditing && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={replaceIngredients.isPending}><Save className="w-4 h-4 mr-2" /> Guardar</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {!recipe ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ChefHat className="w-16 h-16 mb-4 opacity-20" />
                  <p className="mb-4">Este producto no tiene receta.</p>
                  <Button onClick={handleCreateRecipe} disabled={createRecipe.isPending}>Crear Receta</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      {draftIngredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
                          <div className="flex-1 space-y-2">
                            <Label>Ingrediente</Label>
                            <Select value={ing.inventoryItemId.toString()} onValueChange={(v) => updateIngredientRow(idx, "inventoryItemId", Number(v))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-48">
                                {inventory.map(inv => <SelectItem key={inv.id} value={inv.id.toString()}>{inv.name} ({inv.unit})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-32 space-y-2">
                            <Label>Cantidad</Label>
                            <Input type="number" step="0.01" value={ing.quantity || ""} onChange={(e) => updateIngredientRow(idx, "quantity", Number(e.target.value))} />
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeIngredientRow(idx)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full border-dashed" onClick={addIngredientRow}><Plus className="w-4 h-4 mr-2" /> Agregar Ingrediente</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ingredientsData.length === 0 ? (
                        <p className="text-muted-foreground italic">No hay ingredientes. Haz click en Editar para agregar.</p>
                      ) : (
                        <div className="divide-y border rounded-lg overflow-hidden">
                          {ingredientsData.map(ing => (
                            <div key={ing.id} className="p-4 flex justify-between items-center bg-card hover:bg-muted/20 transition-colors">
                              <span className="font-medium text-lg">{ing.inventoryItemName}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-primary">{ing.quantity}</span>
                                <span className="text-sm text-muted-foreground">{ing.unit}</span>
                              </div>
                            </div>
                          ))}
                          {recipeCost > 0 && (
                            <div className="p-4 flex justify-between items-center bg-muted/30 font-medium">
                              <span>Costo total del plato</span>
                              <span className="text-lg font-bold">{formatCurrency(recipeCost)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
            <ChefHat className="w-16 h-16 opacity-20" />
            <p>Selecciona un producto para ver su receta</p>
            <Button variant="outline" onClick={() => setNewProductOpen(true)}><PackagePlus className="w-4 h-4 mr-2" /> Crear nuevo producto</Button>
          </div>
        )}
      </Card>

      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nombre</Label><Input placeholder="ej: Cubetazo, Naranjada" value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Precio de venta (Q)</Label><Input type="number" placeholder="0.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewProductOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreateProduct} disabled={createProduct.isPending || !newName || !newPrice || !newCategoryId}>
                {createProduct.isPending ? "Creando..." : "Crear producto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar nombre del platillo */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar nombre</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del platillo</Label>
              <Input
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditNameOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveName} disabled={updateProduct.isPending || !editNameValue.trim()}>
                {updateProduct.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Precios: {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio normal (Q)</Label>
                <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Tag className="w-3 h-3 text-orange-500" />Precio oferta (Q)</Label>
                <Input type="number" placeholder="Sin oferta" value={editSalePrice} onChange={e => setEditSalePrice(e.target.value)} />
                {editSalePrice && <p className="text-xs text-orange-500">Mesero podrá elegir normal u oferta</p>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Variantes (ej: Cubetazo x5, x6)</Label>
                <Button variant="outline" size="sm" onClick={() => setEditVariants([...editVariants, { name: "", price: "" }])}><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
              </div>
              {editVariants.length === 0 && <p className="text-xs text-muted-foreground">Sin variantes — el mesero verá opciones al seleccionar.</p>}
              {editVariants.map((v, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input placeholder="ej: x5 cervezas" value={v.name} onChange={e => { const n = [...editVariants]; n[i].name = e.target.value; setEditVariants(n); }} />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Precio (Q)</Label>
                    <Input type="number" value={v.price} onChange={e => { const n = [...editVariants]; n[i].price = e.target.value; setEditVariants(n); }} />
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setEditVariants(editVariants.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditPriceOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSavePrice} disabled={updateProduct.isPending}>
                {updateProduct.isPending ? "Guardando..." : "Guardar Precios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
