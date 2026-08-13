const PRODUCT_GROUPS = [
  { category: "抗皱类", products: [["ZPC®Wrinklend008S", "乙酰基六肽-8", "ACETYL HEXAPEPTIDE-8"], ["ZPC®Creasend009S", "乙酰基八肽-3", "ACETYL OCTAPEPTIDE-3"], ["ZPC®Wrinklend017S", "类蛇毒肽", "DIPEPTIDE DIAMINOBUTYROYL BENZYLAMIDE DIACETATE"]] },
  { category: "抗老化类", products: [["ZPC®Collagen005S", "棕榈酰五肽-4", "PALMITOYL PENTAPEPTIDE-4"], ["ZPC®Creasend011S", "棕榈酰三肽-5", "PALMITOYL TRIPEPTIDE-5"], ["ZPC®Wrinklend038S", "基肽", "PALMITOYL TRIPEPTIDE-1 ect."]] },
  { category: "修复类", products: [["ZPC®Repairs012S", "三肽-1铜", "COPPER TRIPEPTIDE-1"], ["ZPC®Repairs012P", "三肽-1铜", "COPPER TRIPEPTIDE-1"], ["ZPC®Collagen045S", "六肽-9", "HEXAPEPTIDE-9"]] },
  { category: "美白类", products: [["ZPC®Whiten022P", "肌肽", "CARNOSINE"], ["ZPC®Whiten022S", "肌肽", "CARNOSINE"], ["ZPC®Whiten016S", "九肽-1", "NONAPEPTIDE-1"]] },
] as const;

export function ProductReferenceTable() {
  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <caption className="visually-hidden">美容肽产品列表</caption>
        <thead><tr><th scope="col">分类</th><th scope="col">产品名称</th><th scope="col">中文名称</th><th scope="col">INCI</th></tr></thead>
        <tbody>
          {PRODUCT_GROUPS.map((group) => group.products.map((product, index) => (
            <tr key={product[0]}>
              {index === 0 ? <th scope="rowgroup" rowSpan={group.products.length}>{group.category}</th> : null}
              <td>{product[0]}</td><td>{product[1]}</td><td>{product[2]}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}
